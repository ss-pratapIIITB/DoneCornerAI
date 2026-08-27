import type { RunEvent } from "@/lib/runs/types";

export type ReplayChart = {
  title: string;
  query: Record<string, unknown>;
};

export type ReplayApproval = {
  threadId: string;
  toolCallId: string;
  name?: string;
};

function queryFromPayload(value: unknown): ReplayChart | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as {
    title?: unknown;
    query?: unknown;
    chart?: { title?: unknown; query?: unknown };
  };
  const query = payload.query ?? payload.chart?.query;
  if (!query || typeof query !== "object") return null;
  return {
    title: String(payload.chart?.title ?? payload.title ?? "Chart"),
    query: query as Record<string, unknown>,
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
  const pending = new Map<string, ReplayApproval>();
  for (const event of events) {
    const toolCallId = String(event.details.toolCallId ?? "");
    if (!toolCallId) continue;
    if (event.type === "approval.requested") {
      pending.set(toolCallId, {
        threadId: String(event.details.threadId ?? "main"),
        toolCallId,
        name: String(event.details.name ?? "Sensitive tool action"),
      });
    } else if (event.type === "approval.resolved") {
      pending.delete(toolCallId);
    }
  }
  return [...pending.values()];
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
