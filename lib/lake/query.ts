import { getPool } from "@/lib/pg/pool";
import { migrateWarehouse } from "@/lib/pg/migrate";
import type { LakeGrain, LakeQuery, LakeRow } from "@/lib/lake/types";
import { ENTITY_LEVELS } from "@/lib/lake/types";
export { drillLake, drillLakeUp, nextLakeGrain, prevLakeGrain } from "@/lib/lake/drill";

const METRIC_ACCOUNTS: Record<string, string[]> = {
  revenue: ["revenue"],
  cogs: ["cogs"],
  opex: ["sm", "rd", "ga"],
  sm: ["sm"],
  capex_tech: ["capex_tech"],
  ap: ["ap"],
  net_income: ["net_income"],
  cash_in: ["cash_in"],
  cash_out: ["cash_out"],
};

function accountsFor(metric: string): string[] {
  return METRIC_ACCOUNTS[metric] ?? [metric];
}

function grainColumn(grain: LakeGrain): string {
  if (grain === "period") return "f.period";
  if (grain === "account") return "f.account";
  return `anc_${grain}.name`;
}

export async function queryLake(q: LakeQuery): Promise<LakeRow[]> {
  await migrateWarehouse();
  const pool = getPool();
  const accounts = q.filters.account?.length ? q.filters.account : accountsFor(q.metric);
  const joins = ENTITY_LEVELS.map((level, i) => {
    const alias = `anc_${level}`;
    if (i === ENTITY_LEVELS.length - 1) {
      return `JOIN entities ${alias} ON ${alias}.id = f.entity_id`;
    }
    const child = `anc_${ENTITY_LEVELS[i + 1]}`;
    return `JOIN entities ${alias} ON ${alias}.id = ${child}.parent_id`;
  }).reverse();

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

  const col = grainColumn(q.grain);
  const sql = `
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
