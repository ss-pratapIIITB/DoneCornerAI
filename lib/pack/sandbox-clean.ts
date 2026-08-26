import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DatabaseSync } from "node:sqlite";

const CLEANER = `
const fs = require("node:fs");
const path = process.argv[2];
const text = fs.readFileSync(path, "utf8").trim();
const lines = text.split(/\\r?\\n/).filter(Boolean);
if (lines.length < 2) {
  process.stdout.write(JSON.stringify({ table: null, rows: [] }));
  process.exit(0);
}
const header = lines[0].split(",").map((h) => h.trim());
const tables = {
  "period,entity,function,account,amount,currency,scenario,source": "facts_pnl",
  "period,entity,cash_in,cash_out,ending_balance,scenario,source": "facts_cash",
  "period,entity,beginning_arr,new,expansion,contraction,churn,ending_arr,source": "facts_arr",
  "period,entity,function,fte,scenario,source": "facts_headcount",
};
const table = tables[header.join(",")] ?? null;
const rows = table
  ? lines.slice(1).map((line) => {
      const cols = line.split(",");
      const src = header.indexOf("source");
      if (src >= 0) cols[src] = "upload";
      const cur = header.indexOf("currency");
      if (cur >= 0) cols[cur] = "USD";
      return cols;
    })
  : [];
process.stdout.write(JSON.stringify({ table, rows }));
`;

export type SandboxCleanResult = {
  ranIn: "child";
  rowsLoaded: number;
  table: string | null;
};

function runChild(scriptPath: string, csvPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, csvPath], {
      env: { PATH: process.env.PATH },
      signal: AbortSignal.timeout(10_000),
    });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => {
      out += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      err += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(err || `Sandbox cleaner exited ${code}`));
        return;
      }
      resolve(out);
    });
  });
}

function insertRows(
  db: DatabaseSync,
  table: string,
  rows: string[][],
): number {
  const sql: Record<string, string> = {
    facts_pnl:
      "INSERT INTO facts_pnl (period, entity, function, account, amount, currency, scenario, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    facts_cash:
      "INSERT INTO facts_cash (period, entity, cash_in, cash_out, ending_balance, scenario, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
    facts_arr:
      "INSERT INTO facts_arr (period, entity, beginning_arr, new, expansion, contraction, churn, ending_arr, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    facts_headcount:
      "INSERT INTO facts_headcount (period, entity, function, fte, scenario, source) VALUES (?, ?, ?, ?, ?, ?)",
  };
  const insertSql = sql[table];
  if (!insertSql) return 0;
  const insert = db.prepare(insertSql);
  db.exec(`DELETE FROM ${table} WHERE source = 'upload'`);
  for (const row of rows) insert.run(...row);
  return rows.length;
}

export async function runSandboxClean(
  db: DatabaseSync,
  csvPath: string,
): Promise<SandboxCleanResult> {
  const dir = join(tmpdir(), "donecorner-sandbox");
  mkdirSync(dir, { recursive: true });
  const scriptPath = join(dir, "clean-close-file.cjs");
  writeFileSync(scriptPath, CLEANER);
  const raw = await runChild(scriptPath, csvPath);
  const parsed = JSON.parse(raw) as { table: string | null; rows: string[][] };
  const rowsLoaded = parsed.table
    ? insertRows(db, parsed.table, parsed.rows)
    : 0;
  return { ranIn: "child", rowsLoaded, table: parsed.table };
}
