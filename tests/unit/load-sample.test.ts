import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { loadSamplePack } from "@/lib/pack/load-sample";

describe("loadSamplePack", () => {
  const dir = mkdtempSync(join(tmpdir(), "donecorner-"));
  const dbPath = join(dir, "t.sqlite");

  beforeAll(() => {
    process.env.DONECORNER_DB = dbPath;
  });

  it("loads 12 distinct pnl periods and ARR rolls forward", () => {
    const db = getDb();
    migrate(db);
    const result = loadSamplePack(db);
    expect(result.periods).toBe(12);

    const periods = db
      .prepare("SELECT COUNT(DISTINCT period) AS n FROM facts_pnl")
      .get() as { n: number };
    expect(periods.n).toBe(12);

    const rows = db
      .prepare(
        "SELECT beginning_arr, new, expansion, contraction, churn, ending_arr FROM facts_arr ORDER BY period",
      )
      .all() as {
      beginning_arr: number;
      new: number;
      expansion: number;
      contraction: number;
      churn: number;
      ending_arr: number;
    }[];

    expect(rows.length).toBe(12);
    for (const row of rows) {
      const expected =
        row.beginning_arr + row.new + row.expansion - row.contraction - row.churn;
      expect(Math.abs(row.ending_arr - expected)).toBeLessThan(0.02);
    }
  });
});
