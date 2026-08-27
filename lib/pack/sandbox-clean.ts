import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { DatabaseSync } from "node:sqlite";

const CLEANER = [
  'const fs = require("node:fs");',
  "const path = process.argv[2];",
  'const text = fs.readFileSync(path, "utf8");',
  "function parseCsv(input) {",
  "  const rows = [];",
  "  let row = [];",
  '  let field = "";',
  "  let inQuotes = false;",
  '  const s = String(input).replace(/^\\uFEFF/, "");',
  "  for (let i = 0; i < s.length; i++) {",
  "    const c = s[i];",
  "    if (inQuotes) {",
  '      if (c === \'"\') {',
  '        if (s[i + 1] === \'"\') { field += \'"\'; i++; }',
  "        else { inQuotes = false; }",
  "      } else { field += c; }",
  "      continue;",
  "    }",
  '    if (c === \'"\') { inQuotes = true; continue; }',
  '    if (c === ",") { row.push(field); field = ""; continue; }',
  '    if (c === "\\n") { row.push(field); field = ""; rows.push(row); row = []; continue; }',
  '    if (c === "\\r") { continue; }',
  "    field += c;",
  "  }",
  "  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }",
  '  return rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));',
  "}",
  "const records = parseCsv(text);",
  "if (records.length < 1) {",
  '  process.stdout.write(JSON.stringify({ table: null, rows: [] }));',
  "  process.exit(0);",
  "}",
  "const header = records[0].map((h) => String(h).trim());",
  "const tables = {",
  '  "period,entity,function,account,amount,currency,scenario,source": "facts_pnl",',
  '  "period,entity,cash_in,cash_out,ending_balance,scenario,source": "facts_cash",',
  '  "period,entity,beginning_arr,new,expansion,contraction,churn,ending_arr,source": "facts_arr",',
  '  "period,entity,function,fte,scenario,source": "facts_headcount",',
  "};",
  "const table = tables[header.join(\",\")] ?? null;",
  "if (!table) {",
  '  process.stdout.write(JSON.stringify({ table: null, rows: [] }));',
  "  process.exit(0);",
  "}",
  "const expected = header.length;",
  "const src = header.indexOf(\"source\");",
  "const cur = header.indexOf(\"currency\");",
  "const numericCols = { facts_pnl: [4], facts_cash: [2, 3, 4], facts_arr: [2, 3, 4, 5, 6, 7], facts_headcount: [3] };",
  "const scenarioCols = { facts_pnl: 6, facts_cash: 5, facts_headcount: 4 };",
  "const rows = [];",
  "for (const cols of records.slice(1)) {",
  "  if (cols.length !== expected) {",
  '    process.stderr.write("CSV row has wrong column count");',
  "    process.exit(1);",
  "  }",
  "  if (cur >= 0 && String(cols[cur]).trim().toUpperCase() !== \"USD\") continue;",
  "  for (const i of numericCols[table] ?? []) {",
  "    if (!Number.isFinite(Number(String(cols[i]).trim())) || String(cols[i]).trim() === \"\") {",
  '      process.stderr.write("CSV row has a non-numeric value");',
  "      process.exit(1);",
  "    }",
  "  }",
  "  const scenarioIdx = scenarioCols[table];",
  "  if (scenarioIdx != null) {",
  "    const scenario = String(cols[scenarioIdx]).trim();",
  "    if (scenario !== \"actual\" && scenario !== \"budget\" && scenario !== \"forecast\") {",
  '      process.stderr.write("CSV row has an invalid scenario");',
  "      process.exit(1);",
  "    }",
  "  }",
  '  if (src >= 0) cols[src] = "upload";',
  "  rows.push(cols);",
  "}",
  "process.stdout.write(JSON.stringify({ table, rows }));",
].join("\n");

const INSERT_SQL: Record<string, string> = {
  facts_pnl:
    "INSERT INTO facts_pnl (period, entity, function, account, amount, currency, scenario, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  facts_cash:
    "INSERT INTO facts_cash (period, entity, cash_in, cash_out, ending_balance, scenario, source) VALUES (?, ?, ?, ?, ?, ?, ?)",
  facts_arr:
    "INSERT INTO facts_arr (period, entity, beginning_arr, new, expansion, contraction, churn, ending_arr, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
  facts_headcount:
    "INSERT INTO facts_headcount (period, entity, function, fte, scenario, source) VALUES (?, ?, ?, ?, ?, ?)",
};

export type SandboxCleanResult = {
  ranIn: "child";
  rowsLoaded: number;
  table: string | null;
};

function runChild(scriptPath: string, csvPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, csvPath], {
      env: { ...process.env, PATH: process.env.PATH },
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

function insertRows(db: DatabaseSync, table: string, rows: string[][]): number {
  const insertSql = INSERT_SQL[table];
  if (!insertSql) return 0;
  const placeholders = insertSql.split("?").length - 1;
  const insert = db.prepare(insertSql);
  db.exec("BEGIN");
  try {
    db.exec(`DELETE FROM ${table} WHERE source = 'upload'`);
    for (const row of rows) {
      if (row.length !== placeholders) {
        throw new Error("CSV row has wrong column count");
      }
      insert.run(...row);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
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
