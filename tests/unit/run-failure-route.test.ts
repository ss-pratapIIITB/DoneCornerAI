import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PATCH } from "@/app/api/runs/[runId]/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import { createRun, getRun, listRunEvents } from "@/lib/runs/ledger";

describe("run failure route", () => {
  it("lets the owner terminate a run whose turn request was interrupted", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-run-fail-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    const run = createRun(db, {
      sessionId: "session-fail",
      userId: "cfo",
      kind: "question",
    });

    const response = await PATCH(
      new Request(`http://localhost/api/runs/${run.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({ summary: "Agent request was interrupted." }),
      }),
      { params: Promise.resolve({ runId: run.id }) },
    );

    expect(response.status).toBe(200);
    expect(getRun(db, run.id)?.status).toBe("error");
    expect(listRunEvents(db, run.id).at(-1)).toMatchObject({
      type: "run.failed",
      summary: "Agent request was interrupted.",
    });
  });
});
