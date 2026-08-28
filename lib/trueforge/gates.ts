import type { ReplayApproval } from "@/lib/runs/replay";

export const QUESTION_CONTINUE_CONTENT =
  "Proceed using the Postgres lake. Do not ask clarifying questions. Query the data and answer the CFO.";

export const QUESTION_STOP_CONTENT = "Stop. The CFO declined to continue.";

export class SessionBlockedError extends Error {
  readonly code = "SESSION_BLOCKED" as const;
  constructor(readonly waitingRunId: string) {
    super(
      "Resolve the pending agent question or approval before starting another turn.",
    );
    this.name = "SessionBlockedError";
  }
}

export function turnInputsForPendingGates(
  decisions: {
    threadId: string;
    toolCallId: string;
    allow: boolean;
    reason?: string;
  }[],
  gates: ReplayApproval[],
): (
  | {
      type: "user.tool_response";
      threadId: string;
      toolCallId: string;
      content: string;
    }
  | {
      type: "user.tool_approval";
      threadId: string;
      toolCallId: string;
      approval: { status: "allow" } | { status: "deny"; reason: string };
    }
)[] {
  const byId = new Map(gates.map((gate) => [gate.toolCallId, gate]));
  return decisions.map((decision) => {
    if (byId.get(decision.toolCallId)?.kind === "question") {
      return {
        type: "user.tool_response",
        threadId: decision.threadId,
        toolCallId: decision.toolCallId,
        content: decision.allow
          ? QUESTION_CONTINUE_CONTENT
          : QUESTION_STOP_CONTENT,
      };
    }
    return {
      type: "user.tool_approval",
      threadId: decision.threadId,
      toolCallId: decision.toolCallId,
      approval: decision.allow
        ? { status: "allow" }
        : { status: "deny", reason: decision.reason ?? "denied" },
    };
  });
}
