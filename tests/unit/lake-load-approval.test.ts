import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  authorizeLakeLoadFromRunApproval,
  requireLakeLoadApproval,
} from "@/lib/lake/approvals";
import { appendRunEvent, createRun } from "@/lib/runs/ledger";
import { callTool } from "@/mcp/tools";

function setup() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-lake-approval-")),
    "test.sqlite",
  );
  const db = getDb();
  migrate(db);
  const run = createRun(db, {
    sessionId: "session-lake",
    userId: "cfo",
    kind: "question",
  });
  return { db, run };
}

describe("load_lake execution approval", () => {
  it("rejects the MCP tool without a current TrueForge approval", async () => {
    const { db, run } = setup();
    await expect(
      callTool(db, "load_lake", { runId: run.id, userId: "cfo" }),
    ).rejects.toThrow(/approval/i);
    expect(() =>
      requireLakeLoadApproval(db, { runId: run.id, userId: "cfo" }),
    ).toThrow(/approval/i);
  });

  it("binds authorization to the run, user, and tool call before truncate", () => {
    const { db, run } = setup();
    appendRunEvent(db, run.id, {
      type: "approval.requested",
      stage: "approval",
      summary: "Approval required for load_lake",
      details: {
        name: "load_lake",
        toolCallId: "call-lake-1",
        arguments: { runId: run.id, userId: "cfo" },
      },
    });

    const denied = authorizeLakeLoadFromRunApproval(db, {
      runId: run.id,
      userId: "cfo",
      toolCallId: "call-lake-1",
      allow: false,
    });
    expect(denied?.status).toBe("denied");
    expect(() =>
      requireLakeLoadApproval(db, { runId: run.id, userId: "cfo" }),
    ).toThrow(/approval/i);

    authorizeLakeLoadFromRunApproval(db, {
      runId: run.id,
      userId: "cfo",
      toolCallId: "call-lake-1",
      allow: true,
    });
    expect(
      requireLakeLoadApproval(db, { runId: run.id, userId: "cfo" }).toolCallId,
    ).toBe("call-lake-1");
  });
});
