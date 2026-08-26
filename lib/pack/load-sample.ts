import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { DatabaseSync } from "node:sqlite";

function packDir(): string {
  return join(process.cwd(), "data", "northstar");
}

function parseCsv(text: string): string[][] {
  return text
    .trim()
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => line.split(","));
}

export function loadSamplePack(db: DatabaseSync): { periods: number } {
  db.exec("DELETE FROM facts_pnl WHERE source = 'sample'");
  db.exec("DELETE FROM facts_cash WHERE source = 'sample'");
  db.exec("DELETE FROM facts_arr WHERE source = 'sample'");
  db.exec("DELETE FROM facts_headcount WHERE source = 'sample'");

  const insertPnl = db.prepare(
    "INSERT INTO facts_pnl (period, entity, function, account, amount, currency, scenario, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const row of parseCsv(readFileSync(join(packDir(), "facts_pnl.csv"), "utf8"))) {
    insertPnl.run(...row);
  }

  const insertCash = db.prepare(
    "INSERT INTO facts_cash (period, entity, cash_in, cash_out, ending_balance, scenario, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  for (const row of parseCsv(readFileSync(join(packDir(), "facts_cash.csv"), "utf8"))) {
    insertCash.run(...row);
  }

  const insertArr = db.prepare(
    "INSERT INTO facts_arr (period, entity, beginning_arr, new, expansion, contraction, churn, ending_arr, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const row of parseCsv(readFileSync(join(packDir(), "facts_arr.csv"), "utf8"))) {
    insertArr.run(...row);
  }

  const insertHc = db.prepare(
    "INSERT INTO facts_headcount (period, entity, function, fte, scenario, source) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const row of parseCsv(readFileSync(join(packDir(), "facts_headcount.csv"), "utf8"))) {
    insertHc.run(...row);
  }

  const periods = db
    .prepare("SELECT COUNT(DISTINCT period) AS n FROM facts_pnl")
    .get() as { n: number };
  return { periods: Number(periods.n) };
}
