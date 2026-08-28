import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/runs/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import { createRun, updateRun } from "@/lib/runs/ledger";

describe("POST /api/runs", () => {
  it("refuses a new run while the TrueForge session is waiting on a person", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-runs-block-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    const waiting = createRun(db, {
      sessionId: "session-block",
      userId: "cfo",
      kind: "question",
    });
    updateRun(db, waiting.id, {
      status: "waiting_approval",
      currentStage: "approval",
    });

    const response = await POST(
      new Request("http://localhost/api/runs", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({
          sessionId: "session-block",
          kind: "question",
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "SESSION_BLOCKED",
      waitingRunId: waiting.id,
    });
  });
});
