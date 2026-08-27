import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  appendRunEvent,
  createRun,
  getRun,
  listRunEvents,
  listRuns,
  updateRun,
} from "@/lib/runs/ledger";

function freshDb() {
  process.env.DONECORNER_DB = join(mkdtempSync(join(tmpdir(), "dc-run-")), "test.sqlite");
  const db = getDb();
  migrate(db);
  return db;
}

describe("run ledger", () => {
  it("persists ordered events and replays after a sequence", () => {
    const db = freshDb();
    const run = createRun(db, {
      sessionId: "session-1",
      kind: "question",
      userId: "cfo",
    });

    const first = appendRunEvent(db, run.id, {
      type: "tool.started",
      stage: "query",
      summary: "Calling query_lake",
      details: { name: "query_lake" },
    });
    const second = appendRunEvent(db, run.id, {
      type: "tool.completed",
      stage: "query",
      summary: "query_lake completed",
      details: { rows: 3 },
    });

    expect(first.sequence).toBe(1);
    expect(second.sequence).toBe(2);
    expect(listRunEvents(db, run.id, 1)).toEqual([second]);
  });

  it("updates run status and strips sensitive event details", () => {
    const db = freshDb();
    const run = createRun(db, {
      sessionId: "session-2",
      kind: "file_ingest",
      userId: "cfo",
    });

    const event = appendRunEvent(db, run.id, {
      type: "artifact.inspected",
      stage: "inspect",
      summary:
        "Inspected upload with token=top-secret at /Users/cfo/private.csv",
      details: {
        artifactId: "artifact-1",
        storagePath: "/private/quarantine/upload.csv",
        token: "secret",
        content: "Authorization Bearer abc.def.ghi output token=supersecret",
      },
    });
    updateRun(db, run.id, { status: "waiting_approval", currentStage: "mapping" });

    expect(event.details).toEqual({
      artifactId: "artifact-1",
      storagePath: "[redacted]",
      token: "[redacted]",
      content:
        "Authorization Bearer [redacted] output token=[redacted]",
    });
    expect(event.summary).toBe(
      "Inspected upload with token=[redacted] at [redacted-path]",
    );
    expect(getRun(db, run.id)).toMatchObject({
      status: "waiting_approval",
      currentStage: "mapping",
    });
  });

  it("does not let later updates leave a terminal run", () => {
    const db = freshDb();
    const run = createRun(db, {
      sessionId: "session-3",
      kind: "question",
      userId: "cfo",
    });
    updateRun(db, run.id, { status: "error", currentStage: "error" });
    expect(updateRun(db, run.id, { status: "done", currentStage: "complete" })).toMatchObject({
      status: "error",
    });
    expect(getRun(db, run.id)?.status).toBe("error");
  });

  it("lists only runs owned by the requesting user", () => {
    const db = freshDb();
    createRun(db, {
      sessionId: "shared-looking-session",
      kind: "question",
      userId: "cfo",
    });
    const fpna = createRun(db, {
      sessionId: "shared-looking-session",
      kind: "question",
      userId: "fpna",
    });

    expect(
      listRuns(db, {
        sessionId: "shared-looking-session",
        userId: "fpna",
      }),
    ).toEqual([fpna]);
  });
});
