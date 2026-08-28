import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trueforge/client", () => ({
  trueforgeBaseUrl: () => "http://trueforge.test",
  trueforge: () => ({
    sessions: {
      createTurnStream: async () =>
        (async function* () {
          throw new Error(
            "UnprocessableEntityError: user message cannot be sent while approvals or questions are pending",
          );
        })(),
    },
  }),
}));

import { getDb, migrate } from "@/lib/db/sqlite";
import { appendRunEvent, createRun, getRun } from "@/lib/runs/ledger";
import { pendingApprovalsFromRunEvents } from "@/lib/runs/replay";
import { bindAgentSession } from "@/lib/runs/sessions";
import { runApprovalTurn } from "@/lib/trueforge/session";

describe("runApprovalTurn resume failures", () => {
  it("keeps the human gate when the continuation stream fails", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-resume-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    bindAgentSession(db, "session-resume", "cfo");
    const run = createRun(db, {
      sessionId: "session-resume",
      userId: "cfo",
      kind: "question",
    });
    appendRunEvent(db, run.id, {
      type: "tool.started",
      stage: "tool",
      summary: "Calling ask_user_question",
      details: {
        name: "ask_user_question",
        toolCallId: "call_q",
        threadId: "main",
      },
    });
    appendRunEvent(db, run.id, {
      type: "run.waiting_approval",
      stage: "approval",
      summary: "Waiting for approval",
      details: {
        requiredActions: [
          {
            type: "tool.response_required",
            threadId: "main",
            toolCalls: [{ id: "call_q" }],
          },
        ],
      },
    });

    const result = await runApprovalTurn(
      "session-resume",
      [{ threadId: "main", toolCallId: "call_q", allow: true }],
      "cfo",
      run.id,
    );

    expect(result.status).toBe("waiting_approval");
    expect(getRun(db, run.id)?.status).toBe("waiting_approval");
    expect(pendingApprovalsFromRunEvents(result.events ?? [])).toEqual([
      expect.objectContaining({
        toolCallId: "call_q",
        kind: "question",
      }),
    ]);
  });
});
