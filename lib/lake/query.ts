import { getPool } from "@/lib/pg/pool";
import { migrateWarehouse } from "@/lib/pg/migrate";
import type { LakeGrain, LakeQuery, LakeRow } from "@/lib/lake/types";
import { ENTITY_LEVELS, parseLakeGrain } from "@/lib/lake/types";
import {
  accountsForLakeMetric,
  isLakeMetric,
} from "@/lib/lake/metrics";
export { drillLake, drillLakeUp, nextLakeGrain, prevLakeGrain } from "@/lib/lake/drill";

function accountsFor(metric: string): string[] {
  if (!isLakeMetric(metric)) throw new Error(`Unsupported lake metric ${metric}`);
  return accountsForLakeMetric(metric);
}

function grainColumn(grain: LakeGrain): string {
  if (grain === "period") return "f.period";
  if (grain === "account") return "f.account";
  return `anc_${grain}.name`;
}

export async function queryLake(q: LakeQuery): Promise<LakeRow[]> {
  const grain = parseLakeGrain(q.grain);
  await migrateWarehouse();
  const pool = getPool();
  const accounts = q.filters.account?.length ? q.filters.account : accountsFor(q.metric);
  const joins = ENTITY_LEVELS.map(
    (level) =>
      `LEFT JOIN entity_lineage anc_${level}
         ON anc_${level}.leaf_id = f.entity_id
        AND anc_${level}.level = '${level}'`,
  );

  const where: string[] = ["f.scenario = $1", `f.account = ANY($2)`];
  const params: unknown[] = [q.filters.scenario ?? "actual", accounts];
  let p = 3;
  for (const level of ENTITY_LEVELS) {
    const v = q.filters[level];
    if (v) {
      where.push(`anc_${level}.name = $${p}`);
      params.push(v);
      p += 1;
    }
  }
  if (q.filters.period?.length) {
    where.push(`f.period = ANY($${p})`);
    params.push(q.filters.period);
  }

  const col = grainColumn(grain);
  const sql = `
    WITH RECURSIVE entity_lineage AS (
      SELECT id AS leaf_id, id, parent_id, level, name
      FROM entities
      UNION ALL
      SELECT child.leaf_id, parent.id, parent.parent_id, parent.level, parent.name
      FROM entity_lineage child
      JOIN entities parent ON parent.id = child.parent_id
    )
    SELECT ${col} AS key, ${col} AS label, SUM(f.amount)::float AS value
    FROM facts f
    ${joins.join("\n")}
    WHERE ${where.join(" AND ")}
    GROUP BY 1
    ORDER BY 1
  `;
  const res = await pool.query<{ key: string; label: string; value: number }>(sql, params);
  return res.rows.map((r) => ({
    key: String(r.key),
    label: String(r.label),
    value: Math.round(Number(r.value) * 100) / 100,
  }));
}

export async function queryPnlTable(filters: LakeQuery["filters"]): Promise<{
  periods: string[];
  accounts: string[];
  cells: Record<string, Record<string, number>>;
}> {
  const accounts = [...accountsFor("revenue"), "cogs", "sm", "rd", "ga", "capex_tech", "ap", "net_income"];
  const periodsSet = new Set<string>();
  const cells: Record<string, Record<string, number>> = {};
  for (const account of accounts) {
    const rows = await queryLake({
      metric: account,
      grain: "period",
      filters: { ...filters, account: [account] },
    });
    cells[account] = {};
    for (const row of rows) {
      periodsSet.add(row.key);
      cells[account][row.key] = row.value;
    }
  }
  const periods = [...periodsSet].sort();
  return { periods, accounts, cells };
}
