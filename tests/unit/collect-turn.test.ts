import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDb, migrate } from "@/lib/db/sqlite";
import { createRun, getRun, listRunEvents, updateRun } from "@/lib/runs/ledger";
import { collectTurn } from "@/lib/trueforge/session";

function fresh() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-collect-")),
    "test.sqlite",
  );
  const db = getDb();
  migrate(db);
  const run = createRun(db, {
    sessionId: "session-collect",
    userId: "cfo",
    kind: "question",
  });
  return { db, run };
}

describe("collectTurn terminal races", () => {
  it("reports persisted error instead of done when the run is already failed", async () => {
    const { db, run } = fresh();
    const stream = (async function* () {
      yield { data: { type: "model.message.delta", content: "partial" } };
      updateRun(db, run.id, { status: "error", currentStage: "error" });
      yield { data: { type: "turn.done", state: { status: "done", output: { content: "Complete" } } } };
    })();

    const result = await collectTurn(stream, run.id);
    expect(result.status).toBe("error");
    expect(getRun(db, run.id)?.status).toBe("error");
    expect(
      listRunEvents(db, run.id).some((event) => event.type === "run.completed"),
    ).toBe(false);
  });

  it("keeps a completed run as done if the stream later throws", async () => {
    const { db, run } = fresh();
    const stream = (async function* () {
      yield { data: { type: "turn.done", state: { status: "done", output: { content: "Complete" } } } };
      updateRun(db, run.id, { status: "done", currentStage: "complete" });
      throw new Error("socket closed");
    })();

    const result = await collectTurn(stream, run.id);
    expect(result.status).toBe("done");
    expect(getRun(db, run.id)?.status).toBe("done");
  });

  it("keeps a cancelled run from being reported as done", async () => {
    const { db, run } = fresh();
    const stream = (async function* () {
      yield { data: { type: "model.message.delta", content: "partial" } };
      updateRun(db, run.id, { status: "cancelled", currentStage: "complete" });
      yield { data: { type: "turn.done", state: { status: "done" } } };
    })();

    const result = await collectTurn(stream, run.id);
    expect(result.status).toBe("error");
    expect(getRun(db, run.id)?.status).toBe("cancelled");
  });
});
