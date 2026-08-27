import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trueforge/session", () => ({
  probeTrueForge: vi.fn(async () => ({
    ok: false,
    reason: "TrueForge is unavailable in this test.",
  })),
  runUserTurn: vi.fn(),
}));

import { POST } from "@/app/api/session/turn/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import { createRun, getRun, listRunEvents } from "@/lib/runs/ledger";

describe("agent turn route", () => {
  it("marks an owned observable run failed when startup is unavailable", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-turn-route-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    const run = createRun(db, {
      sessionId: "session-turn",
      userId: "cfo",
      kind: "question",
    });

    const response = await POST(
      new Request("http://localhost/api/session/turn", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({
          sessionId: "session-turn",
          runId: run.id,
          message: "Explain revenue",
        }),
      }),
    );

    expect(response.status).toBe(503);
    expect(getRun(db, run.id)).toMatchObject({
      status: "error",
      currentStage: "error",
    });
    expect(listRunEvents(db, run.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "run.failed",
          summary: "TrueForge is unavailable in this test.",
        }),
      ]),
    );
  });
});
