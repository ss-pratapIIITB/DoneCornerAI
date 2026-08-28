import type { RunEvent } from "@/lib/runs/types";

const SYSTEM_TOOLS = new Set(["list_tools", "get_tool_info", "call_tool"]);

export type ActivityStatus = "running" | "done" | "failed" | "waiting";

export type ActivityStep = {
  key: string;
  kind: "tool" | "sandbox" | "subagent" | "approval" | "mcp" | "run";
  name: string;
  status: ActivityStatus;
  summary: string;
  system: boolean;
  details: Record<string, unknown>;
};

function upsert(
  steps: Map<string, ActivityStep>,
  order: string[],
  key: string,
  patch: Omit<ActivityStep, "key">,
): void {
  const current = steps.get(key);
  if (!current) {
    order.push(key);
    steps.set(key, { key, ...patch });
    return;
  }
  steps.set(key, {
    ...current,
    ...patch,
    details: { ...current.details, ...patch.details },
  });
}

export function groupRunActivity(events: RunEvent[]): ActivityStep[] {
  const steps = new Map<string, ActivityStep>();
  const order: string[] = [];

  for (const event of events) {
    if (event.type === "message.delta" || event.type === "user.message") continue;

    if (event.type === "tool.started" || event.type === "tool.completed" || event.type === "tool.failed") {
      const name = String(event.details.name ?? "tool");
      const id = String(event.details.toolCallId ?? "");
      if (!id || name === "tool") continue;
      upsert(steps, order, `tool:${id}`, {
        kind: "tool",
        name,
        status:
          event.type === "tool.failed"
            ? "failed"
            : event.type === "tool.completed"
              ? "done"
              : "running",
        summary: event.summary,
        system: SYSTEM_TOOLS.has(name),
        details: event.details,
      });
      continue;
    }

    if (event.type === "sandbox.created") {
      upsert(steps, order, `sandbox:${event.id}`, {
        kind: "sandbox",
        name: "sandbox",
        status: "done",
        summary: event.summary,
        system: false,
        details: event.details,
      });
      continue;
    }

    if (event.type === "subagent.started" || event.type === "subagent.completed" || event.type === "subagent.failed") {
      const thread = String(event.details.threadId ?? event.id);
      upsert(steps, order, `subagent:${thread}`, {
        kind: "subagent",
        name: String(event.details.title ?? "Subagent"),
        status:
          event.type === "subagent.failed"
            ? "failed"
            : event.type === "subagent.completed"
              ? "done"
              : "running",
        summary: event.summary,
        system: false,
        details: event.details,
      });
      continue;
    }

    if (event.type === "approval.requested" || event.type === "approval.resolved") {
      const id = String(event.details.toolCallId ?? event.id);
      upsert(steps, order, `approval:${id}`, {
        kind: "approval",
        name: String(event.details.name ?? "action"),
        status: event.type === "approval.requested" ? "waiting" : "done",
        summary: event.summary,
        system: false,
        details: event.details,
      });
      continue;
    }

    if (event.type === "mcp.connected" || event.type === "mcp.auth_required") {
      upsert(steps, order, `mcp:${event.type}`, {
        kind: "mcp",
        name: "mcp",
        status: event.type === "mcp.auth_required" ? "waiting" : "done",
        summary: event.summary,
        system: true,
        details: event.details,
      });
    }
  }

  return order.map((key) => steps.get(key)!);
}

export function activityHeadline(
  steps: ActivityStep[],
  runStatus: string,
): string {
  const running = steps.find((step) => step.status === "running" && !step.system);
  if (runStatus === "running" && running) return `Calling ${running.name}`;
  const failed = steps.filter((step) => step.status === "failed");
  if (failed.length === 1) return `${failed[0].name} failed`;
  if (failed.length > 1) return `${failed.length} tools failed`;
  const names = [
    ...new Set(
      steps
        .filter((step) => step.kind === "tool" && !step.system)
        .map((step) => step.name),
    ),
  ];
  if (names.length === 1) return `Used ${names[0]}`;
  if (names.length > 1 && names.length <= 3) return `Used ${names.join(", ")}`;
  if (names.length > 3) return `Used ${names.length} tools`;
  if (runStatus === "waiting_approval") return "Waiting for approval";
  if (steps.some((step) => step.system)) return "Looked up tools";
  if (runStatus === "running" || runStatus === "queued") {
    return "Waiting for the first agent event";
  }
  if (runStatus === "done") return "Replied without tools";
  return "Agent activity";
}
