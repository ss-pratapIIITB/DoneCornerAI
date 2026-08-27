import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "pg";
import { databaseUrl } from "@/lib/pg/config";
import { seedLake } from "@/lib/lake/seed";
import { queryLake, queryPnlTable } from "@/lib/lake/query";
import { queryWarehouseSql } from "@/lib/lake/sql";

async function postgresUp(): Promise<boolean> {
  const client = new Client({ connectionString: databaseUrl() });
  try {
    await client.connect();
    await client.query("SELECT 1");
    await client.end();
    return true;
  } catch {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
    return false;
  }
}

const live = await postgresUp();

describe.skipIf(!live)("Postgres lake", () => {
  beforeAll(async () => {
    process.env.DONECORNER_LAKE = "data/lake/raw";
    await seedLake();
  }, 60_000);

  afterAll(async () => {
    /* leave seeded warehouse for the local demo */
  });

  it("returns twelve period rows for revenue", async () => {
    const rows = await queryLake({
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    });
    expect(rows).toHaveLength(12);
    expect(rows[0]?.key).toBe("2025-01");
    expect(rows.every((r) => r.value > 0)).toBe(true);
  });

  it("drills a period into group names", async () => {
    const rows = await queryLake({
      metric: "revenue",
      grain: "group",
      filters: { scenario: "actual", period: ["2025-01"] },
    });
    expect(rows.some((r) => r.key === "Northstar Group")).toBe(true);
  });

  it("builds a P&L table with accounts and periods", async () => {
    const pnl = await queryPnlTable({ scenario: "actual" });
    expect(pnl.periods).toHaveLength(12);
    expect(pnl.accounts).toContain("sm");
    expect(pnl.accounts).toContain("capex_tech");
    expect(pnl.cells.revenue?.["2025-01"]).toBeGreaterThan(0);
  });

  it("runs read-only SQL over facts via MCP-shaped query", async () => {
    const result = await queryWarehouseSql(
      "SELECT COUNT(*)::int AS n FROM facts WHERE scenario = 'actual'",
    );
    expect(result.columns).toContain("n");
    expect(Number(result.rows[0]?.n)).toBeGreaterThan(1000);
  });
});
