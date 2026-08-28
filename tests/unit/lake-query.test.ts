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

  it("returns two Cloud revenue bars for Feb vs August", async () => {
    const { coerceLakeQuery } = await import("@/lib/lake/coerce-query");
    const rows = await queryLake(
      coerceLakeQuery({
        metric: "revenue",
        grain: "period",
        filters: {
          scenario: "actual",
          company: "Cloud",
          period: ["Feb", "August"],
        },
      }),
    );
    expect(rows.map((row) => row.key)).toEqual(["2025-02", "2025-08"]);
    expect(rows.every((row) => row.value > 0)).toBe(true);
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

  it("keeps facts attached above product level visible", async () => {
    const client = new Client({ connectionString: databaseUrl() });
    await client.connect();
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO facts
        (entity_id, period, account, amount, currency, scenario, source)
       VALUES ('co-northstar-saas', '2026-01', 'revenue', 42, 'USD', 'actual', 'test')
       RETURNING id`,
    );
    try {
      const rows = await queryLake({
        metric: "revenue",
        grain: "period",
        filters: { scenario: "actual", period: ["2026-01"] },
      });
      expect(rows).toEqual([
        { key: "2026-01", label: "2026-01", value: 42 },
      ]);
    } finally {
      await client.query("DELETE FROM facts WHERE id = $1", [
        inserted.rows[0]!.id,
      ]);
      await client.end();
    }
  });
});
