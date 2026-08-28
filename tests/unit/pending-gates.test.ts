import { describe, expect, it } from "vitest";
import {
  pendingApprovalsForRequest,
  pendingApprovalsFromRunEvents,
  sessionRailState,
  type ReplayApproval,
} from "@/lib/runs/replay";
import type { RunEvent } from "@/lib/runs/types";
import {
  QUESTION_CONTINUE_CONTENT,
  QUESTION_STOP_CONTENT,
  turnInputsForPendingGates,
} from "@/lib/trueforge/gates";

function event(
  type: RunEvent["type"],
  summary: string,
  details: Record<string, unknown>,
): RunEvent {
  return {
    id: summary,
    runId: "run-wait",
    sequence: 1,
    type,
    stage: "approval",
    summary,
    details,
    createdAt: "2026-08-27T18:36:00.000Z",
  };
}

describe("pending human gates", () => {
  it("recovers ask_user_question call ids from turn.done requiredActions", () => {
    const pending = pendingApprovalsFromRunEvents([
      event("tool.started", "Calling ask_user_question", {
        name: "ask_user_question",
        toolCallId: "call_3Do5poCSmEdrHE8WLSamkTs8",
        threadId: "main",
      }),
      event("approval.requested", "tool needs input", {
        toolCallId: "",
        name: "tool",
        threadId: "main",
        responseRequired: true,
      }),
      event("run.waiting_approval", "Waiting for approval", {
        status: "done",
        requiredActions: [
          {
            type: "tool.response_required",
            threadId: "main",
            toolCalls: [{ id: "call_3Do5poCSmEdrHE8WLSamkTs8" }],
          },
        ],
      }),
    ]);

    expect(pending).toEqual<ReplayApproval[]>([
      {
        threadId: "main",
        toolCallId: "call_3Do5poCSmEdrHE8WLSamkTs8",
        name: "ask_user_question",
        kind: "question",
      },
    ]);
  });

  it("keeps the session waiting when a later turn errors", () => {
    const rail = sessionRailState([
      {
        id: "run-wait",
        status: "waiting_approval",
        events: [
          event("run.waiting_approval", "Waiting for approval", {
            requiredActions: [
              {
                type: "tool.response_required",
                threadId: "main",
                toolCalls: [{ id: "call_q" }],
              },
            ],
          }),
        ],
      },
      {
        id: "run-error",
        status: "error",
        events: [
          event("run.failed", "thread main: user message cannot be sent", {}),
        ],
      },
    ]);

    expect(rail).toMatchObject({
      activeRunId: "run-wait",
      status: "waiting_approval",
    });
    expect(rail.pending[0]?.toolCallId).toBe("call_q");
  });

  it("answers questions with user.tool_response and tools with user.tool_approval", () => {
    expect(
      turnInputsForPendingGates(
        [
          { threadId: "main", toolCallId: "q1", allow: true },
          { threadId: "main", toolCallId: "a1", allow: true },
        ],
        [
          {
            threadId: "main",
            toolCallId: "q1",
            name: "ask_user_question",
            kind: "question",
          },
          {
            threadId: "main",
            toolCallId: "a1",
            name: "load_lake",
            kind: "approval",
          },
        ],
      ),
    ).toEqual([
      {
        type: "user.tool_response",
        threadId: "main",
        toolCallId: "q1",
        content: QUESTION_CONTINUE_CONTENT,
      },
      {
        type: "user.tool_approval",
        threadId: "main",
        toolCallId: "a1",
        approval: { status: "allow" },
      },
    ]);
    expect(
      turnInputsForPendingGates(
        [{ threadId: "main", toolCallId: "q1", allow: false }],
        [
          {
            threadId: "main",
            toolCallId: "q1",
            kind: "question",
          },
        ],
      )[0],
    ).toMatchObject({
      type: "user.tool_response",
      content: QUESTION_STOP_CONTENT,
    });
  });

  it("drops empty tool call ids and prefers ids recovered from run events", () => {
    const events = [
      event("approval.requested", "Approval required for load_lake", {
        name: "load_lake",
        toolCallId: "call-real",
        threadId: "main",
      }),
    ];
    expect(
      pendingApprovalsForRequest(
        [{ threadId: "main", toolCallId: "", kind: "approval" }],
        events,
      ),
    ).toEqual([
      {
        threadId: "main",
        toolCallId: "call-real",
        name: "load_lake",
        kind: "approval",
      },
    ]);
  });
});
