import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { redactRunDetails, redactRunSummary } from "@/lib/runs/redact";
import type {
  AgentRun,
  NewRunEvent,
  RunEvent,
  RunKind,
  RunStatus,
} from "@/lib/runs/types";

type RunRow = {
  id: string;
  session_id: string;
  user_id: string;
  kind: RunKind;
  status: RunStatus;
  current_stage: string;
  prompt_version_id: string | null;
  created_at: string;
  updated_at: string;
};

type EventRow = {
  id: string;
  run_id: string;
  sequence: number;
  type: RunEvent["type"];
  stage: string;
  summary: string;
  details_json: string;
  created_at: string;
};

function toRun(row: RunRow): AgentRun {
  return {
    id: row.id,
    sessionId: row.session_id,
    userId: row.user_id,
    kind: row.kind,
    status: row.status,
    currentStage: row.current_stage,
    promptVersionId: row.prompt_version_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toEvent(row: EventRow): RunEvent {
  return {
    id: row.id,
    runId: row.run_id,
    sequence: Number(row.sequence),
    type: row.type,
    stage: row.stage,
    summary: row.summary,
    details: JSON.parse(row.details_json) as Record<string, unknown>,
    createdAt: row.created_at,
  };
}

export function createRun(
  db: DatabaseSync,
  input: {
    sessionId: string;
    userId: string;
    kind: RunKind;
    promptVersionId?: string | null;
  },
): AgentRun {
  const now = new Date().toISOString();
  const run: AgentRun = {
    id: randomUUID(),
    sessionId: input.sessionId,
    userId: input.userId,
    kind: input.kind,
    status: "running",
    currentStage: "starting",
    promptVersionId: input.promptVersionId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  db.prepare(
    `INSERT INTO agent_runs
      (id, session_id, user_id, kind, status, current_stage, prompt_version_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    run.id,
    run.sessionId,
    run.userId,
    run.kind,
    run.status,
    run.currentStage,
    run.promptVersionId,
    run.createdAt,
    run.updatedAt,
  );
  return run;
}

export function getRun(db: DatabaseSync, runId: string): AgentRun | null {
  const row = db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(runId) as
    | RunRow
    | undefined;
  return row ? toRun(row) : null;
}

export function updateRun(
  db: DatabaseSync,
  runId: string,
  patch: { status?: RunStatus; currentStage?: string },
): AgentRun {
  const current = getRun(db, runId);
  if (!current) throw new Error("Run not found");
  const nextStatus = patch.status ?? current.status;
  const nextStage = patch.currentStage ?? current.currentStage;
  const updatedAt = new Date().toISOString();
  db.prepare(
    `UPDATE agent_runs
     SET status = ?, current_stage = ?, updated_at = ?
     WHERE id = ?`,
  ).run(nextStatus, nextStage, updatedAt, runId);
  return {
    ...current,
    status: nextStatus,
    currentStage: nextStage,
    updatedAt,
  };
}

export function appendRunEvent(
  db: DatabaseSync,
  runId: string,
  event: NewRunEvent,
): RunEvent {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const details = redactRunDetails(event.details);
  const summary = redactRunSummary(event.summary);
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db
      .prepare(
        "SELECT COALESCE(MAX(sequence), 0) + 1 AS sequence FROM run_events WHERE run_id = ?",
      )
      .get(runId) as { sequence: number };
    const sequence = Number(row.sequence);
    db.prepare(
      `INSERT INTO run_events
        (id, run_id, sequence, type, stage, summary, details_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      runId,
      sequence,
      event.type,
      event.stage,
      summary,
      JSON.stringify(details),
      createdAt,
    );
    db.exec("COMMIT");
    return {
      id,
      runId,
      sequence,
      type: event.type,
      stage: event.stage,
      summary,
      details,
      createdAt,
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function listRunEvents(
  db: DatabaseSync,
  runId: string,
  afterSequence = 0,
): RunEvent[] {
  const rows = db
    .prepare(
      `SELECT * FROM run_events
       WHERE run_id = ? AND sequence > ?
       ORDER BY sequence ASC`,
    )
    .all(runId, afterSequence) as EventRow[];
  return rows.map(toEvent);
}

export function listRuns(
  db: DatabaseSync,
  input: { userId: string; sessionId?: string; limit?: number },
): AgentRun[] {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
  const rows = input.sessionId
    ? (db
        .prepare(
          `SELECT * FROM agent_runs
           WHERE user_id = ? AND session_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(input.userId, input.sessionId, limit) as RunRow[])
    : (db
        .prepare(
          `SELECT * FROM agent_runs
           WHERE user_id = ?
           ORDER BY created_at DESC LIMIT ?`,
        )
        .all(input.userId, limit) as RunRow[]);
  return rows.map(toRun);
}
