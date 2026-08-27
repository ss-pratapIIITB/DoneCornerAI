import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/runs/[runId]/events/route";
import { getDb, migrate } from "@/lib/db/sqlite";
import { appendRunEvent, createRun } from "@/lib/runs/ledger";

describe("run event replay route", () => {
  it("returns only newer events for the run owner", async () => {
    process.env.DONECORNER_DB = join(
      mkdtempSync(join(tmpdir(), "dc-replay-")),
      "test.sqlite",
    );
    const db = getDb();
    migrate(db);
    const run = createRun(db, {
      sessionId: "session-replay",
      userId: "cfo",
      kind: "question",
    });
    appendRunEvent(db, run.id, {
      type: "user.message",
      stage: "input",
      summary: "First",
      details: {},
    });
    appendRunEvent(db, run.id, {
      type: "message.completed",
      stage: "answer",
      summary: "Second",
      details: {},
    });

    const response = await GET(
      new Request(`http://localhost/api/runs/${run.id}/events?after=1`, {
        headers: { "x-demo-user": "cfo" },
      }),
      { params: Promise.resolve({ runId: run.id }) },
    );
    const body = (await response.json()) as {
      run: { id: string };
      events: { sequence: number; summary: string }[];
    };

    expect(response.status).toBe(200);
    expect(body.run.id).toBe(run.id);
    expect(body.events).toEqual([
      expect.objectContaining({ sequence: 2, summary: "Second" }),
    ]);
  });

  it("does not replay another user's run", async () => {
    const db = getDb();
    const run = createRun(db, {
      sessionId: "session-private",
      userId: "cfo",
      kind: "question",
    });
    const response = await GET(
      new Request(`http://localhost/api/runs/${run.id}/events`, {
        headers: { "x-demo-user": "fpna" },
      }),
      { params: Promise.resolve({ runId: run.id }) },
    );
    expect(response.status).toBe(404);
  });
});
