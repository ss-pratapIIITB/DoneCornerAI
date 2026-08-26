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

  it("returns ARR by period without requiring a scenario column", () => {
    const rows = queryCube(getDb(), {
      metric: "arr",
      grain: "period",
      filters: {},
    });
    expect(rows).toHaveLength(12);
    expect(rows[0]?.value).toBeGreaterThan(1_000_000);
  });

  it("returns empty ARR rows at function grain", () => {
    const rows = queryCube(getDb(), {
      metric: "arr",
      grain: "function",
      filters: {},
    });
    expect(rows).toEqual([]);
  });

  it("returns gross margin as a percent, not revenue dollars", () => {
    const margin = queryCube(getDb(), {
      metric: "gross_margin_pct",
      grain: "period",
      filters: { scenario: "actual" },
    });
    const revenue = queryCube(getDb(), base);
    expect(margin[0]?.value).toBeGreaterThan(50);
    expect(margin[0]?.value).toBeLessThan(100);
    expect(margin[0]?.value).not.toBe(revenue[0]?.value);
  });

  it("returns runway in months, not monthly burn dollars", () => {
    const runway = queryCube(getDb(), {
      metric: "runway_months",
      grain: "period",
      filters: { scenario: "actual" },
    });
    const burn = queryCube(getDb(), {
      metric: "net_burn",
      grain: "period",
      filters: { scenario: "actual" },
    });
    expect(runway[0]?.value).not.toBe(burn[0]?.value);
    expect(runway[0]?.value).toBeGreaterThan(1);
    expect(runway[0]?.value).toBeLessThan(200);
  });

  it("computes NRR as a retention percent, not a P&L sum", () => {
    const nrrRows = queryCube(getDb(), {
      metric: "nrr",
      grain: "period",
      filters: {},
    });
    const revenue = queryCube(getDb(), base);
    expect(nrrRows[0]?.value).toBeGreaterThan(80);
    expect(nrrRows[0]?.value).toBeLessThan(150);
    expect(nrrRows[0]?.value).not.toBe(revenue[0]?.value);
  });
});
