import type { RunEvent } from "@/lib/runs/types";
import type { LakeRow } from "@/lib/lake/types";

export type ReplayChart = {
  title: string;
  query: Record<string, unknown>;
  rows?: LakeRow[];
};

export type ReplayApproval = {
  threadId: string;
  toolCallId: string;
  name?: string;
  kind: "approval" | "question";
};

export function asReplayApprovals(
  items?: {
    threadId: string;
    toolCallId: string;
    name?: string;
    kind?: "approval" | "question";
  }[],
): ReplayApproval[] {
  return (items ?? []).map((item) => ({
    threadId: item.threadId,
    toolCallId: item.toolCallId,
    name: item.name,
    kind: item.kind ?? "approval",
  }));
}

function queryFromPayload(value: unknown): ReplayChart | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as {
    title?: unknown;
    query?: unknown;
    rows?: unknown;
    chart?: { title?: unknown; query?: unknown };
  };
  const query = payload.query ?? payload.chart?.query;
  if (!query || typeof query !== "object") return null;
  const rows = Array.isArray(payload.rows)
    ? (payload.rows as LakeRow[])
    : undefined;
  return {
    title: String(payload.chart?.title ?? payload.title ?? "Chart"),
    query: query as Record<string, unknown>,
    rows,
  };
}

export function chartsFromRunEvents(events: RunEvent[]): ReplayChart[] {
  const charts: ReplayChart[] = [];
  for (const event of events) {
    if (event.type !== "tool.completed") continue;
    const chart = queryFromPayload(event.details.response);
    if (chart) charts.push(chart);
  }
  return charts;
}

export function pendingApprovalsFromRunEvents(
  events: RunEvent[],
): ReplayApproval[] {
  const names = new Map<string, string>();
  const pending = new Map<string, ReplayApproval>();

  const rememberName = (id: string, name: string | undefined) => {
    if (id && name && name !== "tool") names.set(id, name);
  };

  const upsert = (
    toolCallId: string,
    patch: Omit<ReplayApproval, "toolCallId">,
  ) => {
    if (!toolCallId) return;
    const current = pending.get(toolCallId);
    pending.set(toolCallId, {
      threadId: patch.threadId,
      toolCallId,
      name: names.get(toolCallId) ?? patch.name ?? current?.name,
      kind: patch.kind,
    });
  };

  for (const event of events) {
    const toolCallId = String(event.details.toolCallId ?? "");
    rememberName(toolCallId, event.details.name ? String(event.details.name) : undefined);

    if (event.type === "approval.requested" && toolCallId) {
      upsert(toolCallId, {
        threadId: String(event.details.threadId ?? "main"),
        name: event.details.name ? String(event.details.name) : undefined,
        kind: event.details.responseRequired === true ? "question" : "approval",
      });
    }

    if (event.type === "run.waiting_approval") {
      const actions = Array.isArray(event.details.requiredActions)
        ? event.details.requiredActions
        : [];
      for (const action of actions) {
        if (!action || typeof action !== "object") continue;
        const rec = action as Record<string, unknown>;
        const type = String(rec.type ?? "");
        const threadId = String(rec.threadId ?? rec.thread_id ?? "main");
        const kind = type.includes("response_required") ? "question" : "approval";
        const calls = Array.isArray(rec.toolCalls)
          ? rec.toolCalls
          : Array.isArray(rec.tool_calls)
            ? rec.tool_calls
            : [];
        for (const call of calls) {
          if (!call || typeof call !== "object") continue;
          const id = String((call as { id?: string }).id ?? "");
          upsert(id, { threadId, kind, name: names.get(id) });
        }
      }
    }

    if (event.type === "approval.resolved" && toolCallId) {
      pending.delete(toolCallId);
    }
  }
  return [...pending.values()];
}

export function pendingApprovalsForRequest(
  pending: ReplayApproval[],
  events: RunEvent[],
): ReplayApproval[] {
  const fromEvents = pendingApprovalsFromRunEvents(events);
  const byId = new Map(fromEvents.map((item) => [item.toolCallId, item]));
  const usable = pending
    .filter((item) => item.toolCallId.trim())
    .map((item) => {
      const recovered = byId.get(item.toolCallId);
      return {
        ...item,
        name: recovered?.name ?? item.name,
        kind: recovered?.kind ?? item.kind,
      };
    });
  if (usable.length) return usable;
  return fromEvents.filter((item) => item.toolCallId.trim());
}

export function sessionRailState(
  runs: { id: string; status: string; events: RunEvent[] }[],
): {
  activeRunId: string | null;
  status: "idle" | "running" | "waiting_approval" | "done" | "error";
  pending: ReplayApproval[];
} {
  const waiting = [...runs]
    .reverse()
    .find((run) => run.status === "waiting_approval");
  if (waiting) {
    return {
      activeRunId: waiting.id,
      status: "waiting_approval",
      pending: pendingApprovalsFromRunEvents(waiting.events),
    };
  }
  const latest = runs.at(-1);
  if (!latest) return { activeRunId: null, status: "idle", pending: [] };
  const status =
    latest.status === "queued" || latest.status === "running"
      ? "running"
      : latest.status === "waiting_approval"
        ? "waiting_approval"
        : latest.status === "done"
          ? "done"
          : "error";
  return { activeRunId: latest.id, status, pending: [] };
}

export function outputFromRunEvents(events: RunEvent[]): string {
  const completed = [...events]
    .reverse()
    .find((event) => event.type === "message.completed");
  if (completed?.summary) return completed.summary;
  const terminal = [...events]
    .reverse()
    .find((event) =>
      [
        "run.completed",
        "run.failed",
        "run.cancelled",
        "run.waiting_approval",
      ].includes(event.type),
    );
  return terminal?.summary ?? events.at(-1)?.summary ?? "";
}
