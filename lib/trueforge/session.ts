import { TrueForgeError } from "@truefoundry/trueforge-sdk";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  appendRunEvent,
  bindRunPromptVersion,
  createRun,
  getRun,
  listRunEvents,
  updateRun,
  waitingRunForSession,
} from "@/lib/runs/ledger";
import {
  createNormalizationContext,
  normalizeTrueForgeEvent,
} from "@/lib/runs/normalize";
import { promptForTurn } from "@/lib/prompts/assembly";
import {
  assertAgentSessionOwner,
  bindAgentSession,
  isAgentSessionOwner,
} from "@/lib/runs/sessions";
import {
  chartsFromRunEvents,
  outputFromRunEvents,
  pendingApprovalsFromRunEvents,
} from "@/lib/runs/replay";
import type { RunEvent, RunKind, RunStatus } from "@/lib/runs/types";
import { trueforge, trueforgeBaseUrl } from "@/lib/trueforge/client";
import { CLOSE_PACK_AGENT, closePackModel, closePackSpec } from "@/lib/trueforge/agent";
import { SessionBlockedError, turnInputsForPendingGates } from "@/lib/trueforge/gates";
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
  origin?: string | null,
): Promise<{ id: string }> {
  const client = trueforge();
  const db = getDb();
  migrate(db);
  if (sessionId && isAgentSessionOwner(db, sessionId, userId)) {
    try {
      const existing = await client.sessions.get(sessionId);
      try {
        await ensureHarness(origin);
      } catch {
        // Session is still usable; MCP re-register can wait for the next health check.
      }
      return { id: existing.data.id };
    } catch (err) {
      const missing =
        err instanceof TrueForgeError && err.statusCode === 404;
      if (!missing) throw err;
    }
  }

  let created: { id: string };
  try {
    await ensureHarness(origin);
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
    kind?: "approval" | "question";
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

function chartFromPayload(
  value: unknown,
): TurnSummary["charts"][number] | null {
  let parsed = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as unknown;
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const body = parsed as {
    chart?: { title?: string; query?: Record<string, unknown> };
    title?: string;
    query?: Record<string, unknown>;
  };
  const query = body.query ?? body.chart?.query;
  if (!query || typeof query !== "object") return null;
  return {
    title: String(body.chart?.title ?? body.title ?? "Chart"),
    query,
  };
}

function humanGateKind(type: string): "approval" | "question" | null {
  if (type.includes("response_required")) return "question";
  if (type.includes("approval")) return "approval";
  return null;
}

function pushPending(
  pendingApprovals: TurnSummary["pendingApprovals"],
  item: TurnSummary["pendingApprovals"][number],
) {
  if (!item.toolCallId) return;
  if (pendingApprovals.some((existing) => existing.toolCallId === item.toolCallId)) {
    return;
  }
  pendingApprovals.push(item);
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
      const chart = chartFromPayload(outputText(event.content ?? event.text));
      if (chart) charts.push(chart);
    }
    if (type === "tool.approval_required" || type === "tool.response_required") {
      status = "waiting_approval";
      const kind = humanGateKind(type) ?? "approval";
      const calls = (event.toolCalls ?? event.tool_calls ?? []) as {
        id?: string;
        toolCallId?: string;
        toolInfo?: { name?: string };
      }[];
      const threadId = String(event.threadId ?? event.thread_id ?? "main");
      for (const call of calls) {
        const toolCallId = String(call.toolCallId ?? call.id ?? "");
        pushPending(pendingApprovals, {
          threadId,
          toolCallId,
          name:
            call.toolInfo?.name ??
            toolNames.get(toolCallId) ??
            (kind === "question" ? "ask_user_question" : undefined),
          kind,
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
      const needsPerson = actions.some((action) =>
        Boolean(humanGateKind(String(action.type ?? ""))),
      );
      if (needsPerson) {
        status = "waiting_approval";
        for (const action of actions) {
          const kind = humanGateKind(String(action.type ?? ""));
          if (!kind) continue;
          const threadId = String(action.threadId ?? action.thread_id ?? "main");
          for (const call of action.tool_calls ?? []) {
            const toolCallId = String(call.id ?? "");
            pushPending(pendingApprovals, {
              threadId,
              toolCallId,
              name: toolNames.get(toolCallId),
              kind,
            });
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
  const waiting = waitingRunForSession(db, {
    sessionId,
    userId: options.userId,
  });
  if (waiting && waiting.id !== runId) {
    throw new SessionBlockedError(waiting.id);
  }
  const userMessage = options.displayMessage ?? message;
  const { guidance, assembled } = promptForTurn(db, options.userId, {
    runContext: options.displayMessage ? message : undefined,
    userMessage,
  });
  bindRunPromptVersion(db, runId, guidance.id);
  appendRunEvent(db, runId, {
    type: "user.message",
    stage: "input",
    summary: userMessage,
    details: { content: userMessage, promptVersionId: guidance.id },
  });
  const stream = await client.sessions.createTurnStream(sessionId, {
    input: [{ type: "user.message", content: assembled.turnText }],
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
    input: turnInputsForPendingGates(
      approvals,
      pendingApprovalsFromRunEvents(listRunEvents(db, activeRunId)),
    ),
  });
  updateRun(db, activeRunId, {
    status: "running",
    currentStage: "approval",
  });
  const result = await collectTurn(stream, activeRunId);
  if (result.status === "error") {
    updateRun(db, activeRunId, {
      status: "waiting_approval",
      currentStage: "approval",
    });
    const events = listRunEvents(db, activeRunId);
    return {
      ...result,
      status: "waiting_approval",
      pendingApprovals: pendingApprovalsFromRunEvents(events),
      events,
    };
  }
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
  const events = listRunEvents(db, activeRunId);
  return {
    ...result,
    pendingApprovals:
      result.status === "waiting_approval"
        ? pendingApprovalsFromRunEvents(events)
        : result.pendingApprovals,
    events,
  };
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

function turnStatusFromRun(
  status: RunStatus | undefined,
): TurnSummary["status"] {
  if (status === "waiting_approval") return "waiting_approval";
  if (status === "done") return "done";
  if (status === "running" || status === "queued") return "running";
  return "error";
}

function summaryFromPersistedRun(
  db: ReturnType<typeof getDb>,
  runId: string,
): TurnSummary {
  const run = getRun(db, runId);
  const events = listRunEvents(db, runId);
  const status = turnStatusFromRun(run?.status);
  return {
    status,
    output: outputFromRunEvents(events),
    pendingApprovals:
      status === "waiting_approval" ? pendingApprovalsFromRunEvents(events) : [],
    charts: chartsFromRunEvents(events),
    runId,
    events,
  };
}

export async function collectTurn(
  stream: AsyncIterable<unknown>,
  runId: string,
): Promise<TurnSummary> {
  const rawEvents: unknown[] = [];
  const db = getDb();
  migrate(db);
  const context = createNormalizationContext();
  let interrupted = false;
  try {
    for await (const item of stream) {
      const current = getRun(db, runId);
      if (
        current &&
        (current.status === "done" ||
          current.status === "error" ||
          current.status === "cancelled")
      ) {
        interrupted = true;
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
      return summaryFromPersistedRun(db, runId);
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
  if (interrupted) return summaryFromPersistedRun(db, runId);
  const persisted = summaryFromPersistedRun(db, runId);
  if (persisted.status === "waiting_approval") return persisted;
  return {
    ...summarizeTurnEvents(rawEvents),
    runId,
    events: listRunEvents(db, runId),
  };
}
