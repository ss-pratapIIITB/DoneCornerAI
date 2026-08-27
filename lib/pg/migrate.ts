import { getPool } from "@/lib/pg/pool";

const DDL = `
CREATE TABLE IF NOT EXISTS lake_objects (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  dataset TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entities (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES entities(id),
  level TEXT NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS facts (
  id BIGSERIAL PRIMARY KEY,
  entity_id TEXT NOT NULL REFERENCES entities(id),
  period TEXT NOT NULL,
  account TEXT NOT NULL,
  amount DOUBLE PRECISION NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  scenario TEXT NOT NULL,
  source TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS facts_entity_period ON facts (entity_id, period);
CREATE INDEX IF NOT EXISTS facts_account ON facts (account);

CREATE TABLE IF NOT EXISTS fact_lineage (
  id BIGSERIAL PRIMARY KEY,
  fact_id BIGINT NOT NULL REFERENCES facts(id) ON DELETE CASCADE,
  artifact_id TEXT NOT NULL,
  run_id TEXT NOT NULL,
  proposal_id TEXT NOT NULL,
  proposal_hash TEXT NOT NULL,
  transform_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mapping_applications (
  idempotency_key TEXT PRIMARY KEY,
  proposal_hash TEXT NOT NULL,
  approval_ref TEXT NOT NULL,
  run_id TEXT NOT NULL,
  rows_written INTEGER NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fact_lineage_artifact
  ON fact_lineage (artifact_id, created_at DESC);
`;

export async function migrateWarehouse(): Promise<void> {
  const pool = getPool();
  await pool.query(DDL);
}
