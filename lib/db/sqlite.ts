import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

let cached: DatabaseSync | null = null;
let cachedPath = "";

export function dbPath(): string {
  return process.env.DONECORNER_DB ?? ".data/donecorner.sqlite";
}

export function getDb(): DatabaseSync {
  const path = dbPath();
  if (cached && cachedPath === path) return cached;
  mkdirSync(dirname(path), { recursive: true });
  cached = new DatabaseSync(path);
  cachedPath = path;
  return cached;
}

export function migrate(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS facts_pnl (
      period TEXT, entity TEXT, function TEXT, account TEXT,
      amount REAL, currency TEXT, scenario TEXT, source TEXT
    );
    CREATE TABLE IF NOT EXISTS facts_cash (
      period TEXT, entity TEXT, cash_in REAL, cash_out REAL,
      ending_balance REAL, scenario TEXT, source TEXT
    );
    CREATE TABLE IF NOT EXISTS facts_arr (
      period TEXT, entity TEXT, beginning_arr REAL, new REAL, expansion REAL,
      contraction REAL, churn REAL, ending_arr REAL, source TEXT
    );
    CREATE TABLE IF NOT EXISTS facts_headcount (
      period TEXT, entity TEXT, function TEXT, fte REAL, scenario TEXT, source TEXT
    );
    CREATE TABLE IF NOT EXISTS dashboards (
      id TEXT PRIMARY KEY,
      name TEXT,
      owner TEXT,
      forked_from TEXT,
      widgets_json TEXT
    );
    CREATE TABLE IF NOT EXISTS publishes (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      personal_id TEXT,
      state TEXT
    );
    CREATE TABLE IF NOT EXISTS agent_runs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      current_stage TEXT NOT NULL DEFAULT '',
      prompt_version_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agent_sessions (
      session_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_events (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(id),
      sequence INTEGER NOT NULL,
      type TEXT NOT NULL,
      stage TEXT NOT NULL,
      summary TEXT NOT NULL,
      details_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(run_id, sequence)
    );
    CREATE INDEX IF NOT EXISTS run_events_run_sequence
      ON run_events(run_id, sequence);
    CREATE INDEX IF NOT EXISTS agent_runs_session_created
      ON agent_runs(session_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS file_artifacts (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      media_type TEXT NOT NULL,
      bytes INTEGER NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL,
      storage_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mapping_proposals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      artifact_id TEXT NOT NULL REFERENCES file_artifacts(id),
      proposal_json TEXT NOT NULL,
      proposal_hash TEXT NOT NULL,
      status TEXT NOT NULL,
      applied_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mapping_proposals_artifact
      ON mapping_proposals(artifact_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS mapping_approvals (
      proposal_id TEXT PRIMARY KEY REFERENCES mapping_proposals(id),
      proposal_hash TEXT NOT NULL,
      artifact_sha256 TEXT NOT NULL,
      run_id TEXT NOT NULL REFERENCES agent_runs(id),
      user_id TEXT NOT NULL,
      tool_call_id TEXT NOT NULL,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      objective TEXT NOT NULL,
      business_context TEXT NOT NULL,
      materiality TEXT NOT NULL,
      dashboard_preferences TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS prompt_versions_owner_created
      ON prompt_versions(owner_id, created_at DESC);
    CREATE TABLE IF NOT EXISTS lake_load_approvals (
      tool_call_id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agent_runs(id),
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      consumed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS lake_load_approvals_run
      ON lake_load_approvals(run_id, user_id, created_at DESC);
  `);
}
