import { describe, expect, it } from "vitest";
import {
  activityHeadline,
  groupRunActivity,
} from "@/lib/runs/activity";
import type { RunEvent } from "@/lib/runs/types";

function event(
  type: RunEvent["type"],
  summary: string,
  details: Record<string, unknown> = {},
  id = summary,
): RunEvent {
  return {
    id,
    runId: "run-1",
    sequence: 1,
    type,
    stage: "tool",
    summary,
    details,
    createdAt: "2026-08-27T18:32:00.000Z",
  };
}

describe("run activity grouping", () => {
  it("drops unnamed streamed tool fragments and collapses start plus complete", () => {
    const steps = groupRunActivity([
      event("tool.started", "Calling tool", { name: "tool", toolCallId: "" }),
      event("tool.started", "Calling query_lake", {
        name: "query_lake",
        toolCallId: "call-1",
      }),
      event("tool.completed", "query_lake completed", {
        name: "query_lake",
        toolCallId: "call-1",
      }),
      event("tool.started", "Calling list_tools", {
        name: "list_tools",
        toolCallId: "call-sys",
      }),
      event("tool.completed", "list_tools completed", {
        name: "list_tools",
        toolCallId: "call-sys",
      }),
      event("tool.completed", "call_tool completed", {
        name: "call_tool",
        toolCallId: "call-wrap",
      }),
      event("tool.failed", "query_sql failed", {
        name: "query_sql",
        toolCallId: "call-2",
      }),
    ]);

    expect(steps.map((step) => step.name)).toEqual([
      "query_lake",
      "list_tools",
      "call_tool",
      "query_sql",
    ]);
    expect(steps.find((step) => step.name === "list_tools")?.system).toBe(true);
    expect(steps.find((step) => step.name === "call_tool")?.system).toBe(true);
    expect(steps.find((step) => step.name === "query_sql")?.status).toBe("failed");
    expect(activityHeadline(steps, "done")).toBe("query_sql failed");
  });

  it("summarizes successful work tools Slack-style", () => {
    const steps = groupRunActivity([
      event("tool.completed", "query_lake completed", {
        name: "query_lake",
        toolCallId: "a",
      }),
      event("tool.completed", "present_chart completed", {
        name: "present_chart",
        toolCallId: "b",
      }),
    ]);
    expect(activityHeadline(steps, "done")).toBe("Used query_lake, present_chart");
  });

  it("hides TrueForge call_tool wrappers behind the work headline", () => {
    const steps = groupRunActivity([
      event("tool.completed", "call_tool completed", {
        name: "call_tool",
        toolCallId: "w1",
      }),
      event("sandbox.created", "Secure sandbox ready", {}),
      event("tool.completed", "exec completed", {
        name: "exec",
        toolCallId: "e1",
      }),
    ]);
    expect(activityHeadline(steps, "done")).toBe("Used exec");
    expect(steps.find((step) => step.name === "call_tool")?.system).toBe(true);
  });

  it("does not pretend a finished text-only turn is still waiting for events", () => {
    expect(activityHeadline([], "done")).toBe("Replied without tools");
    expect(activityHeadline([], "running")).toBe("Waiting for the first agent event");
  });

  it("keeps waiting_approval as the headline even after system tool lookup", () => {
    const steps = groupRunActivity([
      event("tool.completed", "list_tools completed", {
        name: "list_tools",
        toolCallId: "t1",
      }),
      event("approval.requested", "Approval required for call_tool", {
        name: "call_tool",
        toolCallId: "t2",
      }),
    ]);
    expect(activityHeadline(steps, "waiting_approval")).toBe(
      "Waiting for approval",
    );
  });
});

