import { describe, it, expect, beforeAll } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { loadSamplePack } from "@/lib/pack/load-sample";
import { queryCube } from "@/lib/cube/query";
import { drillDown, drillUp } from "@/lib/cube/drill";
import type { CubeQuery } from "@/lib/cube/query";

describe("queryCube and drill", () => {
  beforeAll(() => {
    process.env.DONECORNER_DB = join(mkdtempSync(join(tmpdir(), "dc-q-")), "t.sqlite");
    const db = getDb();
    migrate(db);
    loadSamplePack(db);
  });

  const base: CubeQuery = {
    metric: "revenue",
    grain: "period",
    filters: { scenario: "actual" },
  };

  it("returns 12 revenue periods", () => {
    const rows = queryCube(getDb(), base);
    expect(rows).toHaveLength(12);
    expect(rows[0]?.key).toBe("2025-01");
  });

  it("drills from a period into functions and back up", () => {
    const down = drillDown(base, "2025-06");
    expect(down.grain).toBe("function");
    expect(down.filters.period).toEqual(["2025-06"]);
    const rows = queryCube(getDb(), down);
    expect(rows.length).toBeGreaterThan(0);
    const up = drillUp(down);
    expect(up.grain).toBe("period");
    expect(up.filters.period).toBeUndefined();
  });
});
