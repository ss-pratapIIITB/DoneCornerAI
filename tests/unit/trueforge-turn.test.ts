import { describe, expect, it } from "vitest";
import { summarizeTurnEvents } from "@/lib/trueforge/session";

describe("summarizeTurnEvents", () => {
  it("keeps waiting_approval from required_actions even when HTTP status is done", () => {
    const summary = summarizeTurnEvents([
      {
        type: "tool.approval_required",
        threadId: "main",
        toolCalls: [{ id: "call_1", toolInfo: { name: "request_publish_org" } }],
      },
      {
        type: "turn.done",
        state: {
          status: "done",
          output: { content: "Waiting to overwrite org Close." },
          required_actions: [
            {
              type: "tool.approval_required",
              thread_id: "main",
              tool_calls: [{ id: "call_1" }],
            },
          ],
        },
      },
    ]);
    expect(summary.status).toBe("waiting_approval");
    expect(summary.output).toContain("overwrite");
    expect(summary.pendingApprovals).toEqual([
      { threadId: "main", toolCallId: "call_1", name: "request_publish_org" },
    ]);
  });

  it("treats an error turn as error even if the stream ended 2xx-shaped", () => {
    const summary = summarizeTurnEvents([
      { type: "turn.done", state: { status: "error", output: { content: "model failed" } } },
    ]);
    expect(summary.status).toBe("error");
    expect(summary.output).toBe("model failed");
    expect(summary.pendingApprovals).toEqual([]);
  });
});
