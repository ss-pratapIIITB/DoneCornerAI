import { TrueForgeError } from "@truefoundry/trueforge-sdk";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  appendRunEvent,
  createRun,
  getRun,
  listRunEvents,
  updateRun,
} from "@/lib/runs/ledger";
import {
  createNormalizationContext,
  normalizeTrueForgeEvent,
} from "@/lib/runs/normalize";
import {
  assertAgentSessionOwner,
  bindAgentSession,
  isAgentSessionOwner,
} from "@/lib/runs/sessions";
import type { RunEvent, RunKind, RunStatus } from "@/lib/runs/types";
import { trueforge, trueforgeBaseUrl } from "@/lib/trueforge/client";
import { CLOSE_PACK_AGENT, closePackModel, closePackSpec } from "@/lib/trueforge/agent";
import { ensureHarness } from "@/lib/trueforge/harness";

export async function probeTrueForge(): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const res = await fetch(`${trueforgeBaseUrl().replace(/\/$/, "")}/api/v1/sessions`, {
      signal: AbortSignal.timeout(1500),
    });
    // Auth-gated API still means the harness is up.
    if (res.status === 401 || res.status === 403) return { ok: true };
    if (!res.ok) {
      return { ok: false, reason: "TrueForge API is not reachable." };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      reason: "TrueForge is not running. Start it with npx @truefoundry/trueforge (default http://localhost:8790).",
    };
  }
}

export async function resumeOrCreateSession(
  sessionId: string | null | undefined,
  userId: string,
): Promise<{ id: string }> {
  const client = trueforge();
  const db = getDb();
  migrate(db);
  if (sessionId && isAgentSessionOwner(db, sessionId, userId)) {
    try {
      const existing = await client.sessions.get(sessionId);
      return { id: existing.data.id };
    } catch (err) {
      const missing =
        err instanceof TrueForgeError && err.statusCode === 404;
      if (!missing) throw err;
    }
  }

  let created: { id: string };
  try {
    await ensureHarness();
    const named = await client.sessions.create({
      agent: { name: CLOSE_PACK_AGENT },
    });
    created = { id: named.data.id };
  } catch {
    const inline = await client.sessions.create({
      agent: { spec: closePackSpec(closePackModel()) },
    });
    created = { id: inline.data.id };
  }
  bindAgentSession(db, created.id, userId);
  return created;
}

export type TurnSummary = {
  status: "running" | "waiting_approval" | "done" | "error";
  output: string;
  pendingApprovals: {
    threadId: string;
    toolCallId: string;
    name?: string;
  }[];
  charts: { title: string; query: Record<string, unknown> }[];
  runId?: string;
  events?: RunEvent[];
};

function eventRecord(item: unknown): Record<string, unknown> {
  if (item && typeof item === "object" && "data" in item) {
    return (item as { data: Record<string, unknown> }).data;
  }
  return (item ?? {}) as Record<string, unknown>;
}

function outputText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "content" in value) {
    return String((value as { content?: unknown }).content ?? "");
  }
  return "";
}

export function summarizeTurnEvents(events: unknown[]): TurnSummary {
  let output = "";
  let status: TurnSummary["status"] = "done";
  const pendingApprovals: TurnSummary["pendingApprovals"] = [];
  const charts: TurnSummary["charts"] = [];
  const toolNames = new Map<string, string>();
  for (const item of events) {
    const event = eventRecord(item);
    const type = String(event.type ?? "");
    if (type === "model.message.delta" || type === "model.message") {
      const chunk = outputText(event.content ?? event);
      if (chunk && type === "model.message.delta") output += chunk;
      else if (chunk && type === "model.message" && !output) output = chunk;
      const calls = (event.toolCalls ?? event.tool_calls ?? []) as {
        id?: string;
        function?: { name?: string };
        toolInfo?: { name?: string };
      }[];
      for (const call of calls) {
        if (call.id) {
          toolNames.set(
            call.id,
            String(call.toolInfo?.name ?? call.function?.name ?? "tool"),
          );
        }
      }
    }
    if (type === "tool.response" || type === "tool.result") {
      const raw = outputText(event.content ?? event.text);
      try {
        const parsed = JSON.parse(raw) as {
          chart?: { title?: string; query?: Record<string, unknown> };
          title?: string;
          query?: Record<string, unknown>;
        };
        const query = parsed.query ?? parsed.chart?.query;
        if (query && typeof query === "object") {
          charts.push({
            title: String(parsed.chart?.title ?? parsed.title ?? "Chart"),
            query,
          });
        }
      } catch {
        /* not a chart payload */
      }
    }
    if (type === "tool.approval_required") {
      status = "waiting_approval";
      const calls = (event.toolCalls ?? event.tool_calls ?? []) as {
        id?: string;
        toolCallId?: string;
        toolInfo?: { name?: string };
      }[];
      const threadId = String(event.threadId ?? event.thread_id ?? "main");
      for (const call of calls) {
        pendingApprovals.push({
          threadId,
          toolCallId: String(call.toolCallId ?? call.id ?? ""),
          name:
            call.toolInfo?.name ??
            toolNames.get(String(call.toolCallId ?? call.id ?? "")),
        });
      }
    }
    if (type === "turn.done") {
      const state = event.state as {
        status?: string;
        output?: unknown;
        required_actions?: {
          type?: string;
          thread_id?: string;
          threadId?: string;
          tool_calls?: { id?: string }[];
        }[];
        requiredActions?: {
          type?: string;
          threadId?: string;
          toolCalls?: { id?: string }[];
        }[];
      } | undefined;
      const fromState = outputText(state?.output);
      if (fromState) output = fromState;
      const actions = [
        ...(state?.requiredActions ?? []).map((action) => ({
          type: action.type,
          threadId: action.threadId,
          tool_calls: action.toolCalls,
        })),
        ...(state?.required_actions ?? []),
      ] as {
        type?: string;
        threadId?: string;
        thread_id?: string;
        tool_calls?: { id?: string }[];
      }[];
      const needsApproval = actions.some((a) =>
        String(a.type ?? "").includes("approval"),
      );
      if (needsApproval) {
        status = "waiting_approval";
        for (const action of actions) {
          if (!String(action.type ?? "").includes("approval")) continue;
          const threadId = String(action.threadId ?? action.thread_id ?? "main");
          for (const call of action.tool_calls ?? []) {
            if (!pendingApprovals.some((p) => p.toolCallId === String(call.id ?? ""))) {
              pendingApprovals.push({
                threadId,
                toolCallId: String(call.id ?? ""),
                name: toolNames.get(String(call.id ?? "")),
              });
            }
          }
        }
      } else if (state?.status === "error" || state?.status === "cancelled") {
        status = "error";
      } else if (status !== "waiting_approval") {
        status = state?.status === "error" ? "error" : "done";
      }
    }
  }
  return { status, output, pendingApprovals, charts };
}

export async function runUserTurn(
  sessionId: string,
  message: string,
  options: {
    runId?: string;
    kind?: RunKind;
    userId: string;
    displayMessage?: string;
  },
): Promise<TurnSummary> {
  const client = trueforge();
  const db = getDb();
  migrate(db);
  assertAgentSessionOwner(db, sessionId, options.userId);
  const runId = ensureRun(db, sessionId, options);
  appendRunEvent(db, runId, {
    type: "user.message",
    stage: "input",
    summary: options.displayMessage ?? message,
    details: { content: options.displayMessage ?? message },
  });
  const stream = await client.sessions.createTurnStream(sessionId, {
    input: [{ type: "user.message", content: message }],
  });
  return collectTurn(stream, runId);
}

export async function runApprovalTurn(
  sessionId: string,
  approvals: {
    threadId: string;
    toolCallId: string;
    allow: boolean;
    reason?: string;
  }[],
  userId: string,
  runId?: string,
): Promise<TurnSummary> {
  const client = trueforge();
  const db = getDb();
  migrate(db);
  assertAgentSessionOwner(db, sessionId, userId);
  const activeRunId = ensureRun(db, sessionId, {
    runId,
    kind: "question",
    userId,
  });
  const stream = await client.sessions.createTurnStream(sessionId, {
    input: approvals.map((a) => ({
      type: "user.tool_approval" as const,
      threadId: a.threadId,
      toolCallId: a.toolCallId,
      approval: a.allow
        ? { status: "allow" as const }
        : { status: "deny" as const, reason: a.reason ?? "denied" },
    })),
  });
  for (const approval of approvals) {
    appendRunEvent(db, activeRunId, {
      type: "approval.resolved",
      stage: "approval",
      summary: approval.allow ? "Tool action approved" : "Tool action denied",
      details: {
        threadId: approval.threadId,
        toolCallId: approval.toolCallId,
        allow: approval.allow,
      },
    });
  }
  updateRun(db, activeRunId, {
    status: "running",
    currentStage: "approval",
  });
  return collectTurn(stream, activeRunId);
}

function ensureRun(
  db: ReturnType<typeof getDb>,
  sessionId: string,
  options: { runId?: string; kind?: RunKind; userId: string },
): string {
  if (options.runId) {
    const existing = getRun(db, options.runId);
    if (
      !existing ||
      existing.sessionId !== sessionId ||
      existing.userId !== options.userId
    ) {
      throw new Error("Run does not belong to this session");
    }
    return existing.id;
  }
  return createRun(db, {
    sessionId,
    userId: options.userId,
    kind: options.kind ?? "question",
  }).id;
}

function stateForEvent(event: RunEvent): {
  status?: RunStatus;
  currentStage: string;
} {
  if (event.type === "approval.requested" || event.type === "run.waiting_approval") {
    return { status: "waiting_approval", currentStage: "approval" };
  }
  if (event.type === "run.completed") {
    return { status: "done", currentStage: "complete" };
  }
  if (event.type === "run.failed") {
    return { status: "error", currentStage: "complete" };
  }
  if (event.type === "run.cancelled") {
    return { status: "cancelled", currentStage: "complete" };
  }
  return { currentStage: event.stage };
}

async function collectTurn(
  stream: AsyncIterable<unknown>,
  runId: string,
): Promise<TurnSummary> {
  const rawEvents: unknown[] = [];
  const db = getDb();
  migrate(db);
  const context = createNormalizationContext();
  try {
    for await (const item of stream) {
      const current = getRun(db, runId);
      if (
        current &&
        (current.status === "done" ||
          current.status === "error" ||
          current.status === "cancelled")
      ) {
        break;
      }
      rawEvents.push(item);
      for (const normalized of normalizeTrueForgeEvent(item, context)) {
        const persisted = appendRunEvent(db, runId, normalized);
        updateRun(db, runId, stateForEvent(persisted));
      }
    }
  } catch (err) {
    const current = getRun(db, runId);
    if (
      current &&
      (current.status === "done" ||
        current.status === "error" ||
        current.status === "cancelled")
    ) {
      return {
        status: "error",
        output: err instanceof Error ? err.message : "Turn failed",
        pendingApprovals: [],
        charts: [],
        runId,
        events: listRunEvents(db, runId),
      };
    }
    const message = err instanceof Error ? err.message : "Turn failed";
    appendRunEvent(db, runId, {
      type: "run.failed",
      stage: "complete",
      summary: message,
      details: {},
    });
    updateRun(db, runId, { status: "error", currentStage: "complete" });
    return {
      status: "error",
      output: message,
      pendingApprovals: [],
      charts: [],
      runId,
      events: listRunEvents(db, runId),
    };
  }
  return {
    ...summarizeTurnEvents(rawEvents),
    runId,
    events: listRunEvents(db, runId),
  };
}
