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
  `);
}
