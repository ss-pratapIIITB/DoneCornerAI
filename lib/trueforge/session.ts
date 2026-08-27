import { TrueForgeError } from "@truefoundry/trueforge-sdk";
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

export async function resumeOrCreateSession(sessionId?: string | null): Promise<{ id: string }> {
  const client = trueforge();
  if (sessionId) {
    try {
      const existing = await client.sessions.get(sessionId);
      return { id: existing.data.id };
    } catch (err) {
      const missing =
        err instanceof TrueForgeError && err.statusCode === 404;
      if (!missing) throw err;
    }
  }

  try {
    await ensureHarness();
    const named = await client.sessions.create({
      agent: { name: CLOSE_PACK_AGENT },
    });
    return { id: named.data.id };
  } catch {
    const inline = await client.sessions.create({
      agent: { spec: closePackSpec(closePackModel()) },
    });
    return { id: inline.data.id };
  }
}

export type TurnSummary = {
  status: "running" | "waiting_approval" | "done" | "error";
  output: string;
  pendingApprovals: {
    threadId: string;
    toolCallId: string;
    name?: string;
  }[];
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
  for (const item of events) {
    const event = eventRecord(item);
    const type = String(event.type ?? "");
    if (type === "model.message.delta" || type === "model.message") {
      const chunk = outputText(event.content ?? event);
      if (chunk && type === "model.message.delta") output += chunk;
      else if (chunk && type === "model.message" && !output) output = chunk;
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
          name: call.toolInfo?.name,
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
      } | undefined;
      const fromState = outputText(state?.output);
      if (fromState) output = fromState;
      const actions = state?.required_actions ?? [];
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
  return { status, output, pendingApprovals };
}

export async function runUserTurn(
  sessionId: string,
  message: string,
): Promise<TurnSummary> {
  const client = trueforge();
  const stream = await client.sessions.createTurnStream(sessionId, {
    input: [{ type: "user.message", content: message }],
  });
  return collectTurn(stream);
}

export async function runApprovalTurn(
  sessionId: string,
  approvals: {
    threadId: string;
    toolCallId: string;
    allow: boolean;
    reason?: string;
  }[],
): Promise<TurnSummary> {
  const client = trueforge();
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
  return collectTurn(stream);
}

async function collectTurn(stream: AsyncIterable<unknown>): Promise<TurnSummary> {
  const events: unknown[] = [];
  try {
    for await (const item of stream) events.push(item);
  } catch (err) {
    return {
      status: "error",
      output: err instanceof Error ? err.message : "Turn failed",
      pendingApprovals: [],
    };
  }
  return summarizeTurnEvents(events);
}
