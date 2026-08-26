import type { DatabaseSync } from "node:sqlite";
import {
  grossMarginPct,
  grr,
  mrrFromArr,
  nrr,
  runwayMonths,
} from "@/lib/cube/metrics";
import type { FunctionCode, Grain, MetricId, Scenario } from "@/lib/cube/types";

export type CubeFilters = {
  period?: string[];
  function?: FunctionCode[];
  account?: string[];
  entity?: string[];
  scenario?: Scenario;
};

export type CubeQuery = {
  metric: MetricId;
  grain: Grain;
  filters: CubeFilters;
};

export type CubeRow = { key: string; label: string; value: number };

const REVENUE_ACCOUNTS = ["subscription"];
const OPEX_FUNCTIONS = ["sm", "rd", "ga"];
const PERIOD_ONLY: ReadonlySet<MetricId> = new Set([
  "net_burn",
  "runway_months",
  "burn_vs_budget",
  "arr",
  "mrr",
  "net_new_arr",
  "nrr",
  "grr",
  "rule_of_40",
  "burn_multiple",
  "magic_number",
]);

type FactTable = "pnl" | "cash" | "arr" | "hc";

function grainColumn(grain: Grain): string {
  if (grain === "period") return "period";
  if (grain === "function") return "function";
  return "account";
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toRows(rows: { key: string; value: number }[]): CubeRow[] {
  return rows
    .filter((r) => Number.isFinite(r.value))
    .map((r) => ({
      key: String(r.key),
      label: String(r.key),
      value: round2(Number(r.value)),
    }));
}

function mergeByKey(
  left: CubeRow[],
  right: CubeRow[],
  combine: (a: number, b: number) => number | null,
): CubeRow[] {
  const map = new Map(right.map((r) => [r.key, r.value]));
  const keys = new Set([...left.map((r) => r.key), ...map.keys()]);
  const out: CubeRow[] = [];
  for (const key of keys) {
    const value = combine(
      left.find((r) => r.key === key)?.value ?? 0,
      map.get(key) ?? 0,
    );
    if (value == null || !Number.isFinite(value)) continue;
    out.push({ key, label: key, value: round2(value) });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function whereClause(
  filters: CubeFilters,
  table: FactTable,
  extra: string[] = [],
): { sql: string; params: unknown[] } {
  const clauses = [...extra];
  const params: unknown[] = [];
  if (table !== "arr") {
    clauses.push("scenario = ?");
    params.push(filters.scenario ?? "actual");
  }
  if (filters.period?.length) {
    clauses.push(`period IN (${filters.period.map(() => "?").join(",")})`);
    params.push(...filters.period);
  }
  if ((table === "pnl" || table === "hc") && filters.function?.length) {
    clauses.push(`function IN (${filters.function.map(() => "?").join(",")})`);
    params.push(...filters.function);
  }
  if (table === "pnl" && filters.account?.length) {
    clauses.push(`account IN (${filters.account.map(() => "?").join(",")})`);
    params.push(...filters.account);
  }
  if (filters.entity?.length) {
    clauses.push(`entity IN (${filters.entity.map(() => "?").join(",")})`);
    params.push(...filters.entity);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

function aggregatePnl(
  db: DatabaseSync,
  q: CubeQuery,
  extra: string[] = [],
  extraParams: unknown[] = [],
): CubeRow[] {
  const col = grainColumn(q.grain);
  const { sql, params } = whereClause(q.filters, "pnl", extra);
  const rows = db
    .prepare(
      `SELECT ${col} AS key, SUM(amount) AS value FROM facts_pnl ${sql} GROUP BY ${col} ORDER BY key`,
    )
    .all(...extraParams, ...params) as { key: string; value: number }[];
  return toRows(rows);
}

function revenueRows(db: DatabaseSync, q: CubeQuery): CubeRow[] {
  return aggregatePnl(
    db,
    q,
    [`account IN (${REVENUE_ACCOUNTS.map(() => "?").join(",")})`],
    [...REVENUE_ACCOUNTS],
  );
}

function cogsRows(db: DatabaseSync, q: CubeQuery): CubeRow[] {
  return aggregatePnl(db, q, ["function = 'cogs'"]);
}

function opexRows(db: DatabaseSync, q: CubeQuery): CubeRow[] {
  return aggregatePnl(
    db,
    q,
    [`function IN (${OPEX_FUNCTIONS.map(() => "?").join(",")})`],
    [...OPEX_FUNCTIONS],
  );
}

function cashByPeriod(
  db: DatabaseSync,
  filters: CubeFilters,
): { period: string; burn: number; balance: number }[] {
  const { sql, params } = whereClause(filters, "cash");
  return db
    .prepare(
      `SELECT period, SUM(cash_out - cash_in) AS burn, SUM(ending_balance) AS balance
       FROM facts_cash ${sql} GROUP BY period ORDER BY period`,
    )
    .all(...params) as { period: string; burn: number; balance: number }[];
}

function arrByPeriod(
  db: DatabaseSync,
  filters: CubeFilters,
): {
  period: string;
  beginning: number;
  expansion: number;
  contraction: number;
  churn: number;
  ending: number;
  netNew: number;
}[] {
  const { sql, params } = whereClause(filters, "arr");
  return db
    .prepare(
      `SELECT period,
              SUM(beginning_arr) AS beginning,
              SUM(expansion) AS expansion,
              SUM(contraction) AS contraction,
              SUM(churn) AS churn,
              SUM(ending_arr) AS ending,
              SUM(new + expansion - contraction - churn) AS netNew
       FROM facts_arr ${sql} GROUP BY period ORDER BY period`,
    )
    .all(...params) as {
    period: string;
    beginning: number;
    expansion: number;
    contraction: number;
    churn: number;
    ending: number;
    netNew: number;
  }[];
}

function smByPeriod(db: DatabaseSync, filters: CubeFilters): Map<string, number> {
  const { sql, params } = whereClause(filters, "pnl", ["function = 'sm'"]);
  const rows = db
    .prepare(
      `SELECT period AS key, SUM(amount) AS value FROM facts_pnl ${sql} GROUP BY period`,
    )
    .all(...params) as { key: string; value: number }[];
  return new Map(rows.map((r) => [String(r.key), Number(r.value)]));
}

function fteRows(db: DatabaseSync, q: CubeQuery): CubeRow[] {
  const col = q.grain === "account" ? "period" : grainColumn(q.grain);
  if (q.grain === "account") return [];
  const { sql, params } = whereClause(q.filters, "hc");
  const rows = db
    .prepare(
      `SELECT ${col} AS key, SUM(fte) AS value FROM facts_headcount ${sql} GROUP BY ${col} ORDER BY key`,
    )
    .all(...params) as { key: string; value: number }[];
  return toRows(rows);
}

function priorPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function yearAgo(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return `${y - 1}-${String(m).padStart(2, "0")}`;
}

export function queryCube(db: DatabaseSync, q: CubeQuery): CubeRow[] {
  if (PERIOD_ONLY.has(q.metric) && q.grain !== "period") return [];

  if (q.metric === "revenue") return revenueRows(db, q);
  if (q.metric === "cogs") return cogsRows(db, q);
  if (q.metric === "opex") return opexRows(db, q);

  if (q.metric === "gross_profit") {
    return mergeByKey(revenueRows(db, q), cogsRows(db, q), (rev, cogs) => rev - cogs);
  }
  if (q.metric === "gross_margin_pct") {
    return mergeByKey(revenueRows(db, q), cogsRows(db, q), (rev, cogs) =>
      grossMarginPct(rev, cogs),
    );
  }
  if (q.metric === "ebitda") {
    const gp = mergeByKey(revenueRows(db, q), cogsRows(db, q), (rev, cogs) => rev - cogs);
    return mergeByKey(gp, opexRows(db, q), (profit, opex) => profit - opex);
  }
  if (q.metric === "opex_ratio") {
    return mergeByKey(opexRows(db, q), revenueRows(db, q), (opex, rev) =>
      rev === 0 ? null : (opex / rev) * 100,
    );
  }

  if (q.metric === "bva_amount" || q.metric === "bva_pct") {
    const actual = revenueRows(db, { ...q, filters: { ...q.filters, scenario: "actual" } });
    const budget = revenueRows(db, { ...q, filters: { ...q.filters, scenario: "budget" } });
    return mergeByKey(actual, budget, (a, b) => {
      const amount = a - b;
      if (q.metric === "bva_amount") return amount;
      if (b === 0) return null;
      return (amount / b) * 100;
    });
  }

  if (q.metric === "rev_per_fte") {
    return mergeByKey(revenueRows(db, q), fteRows(db, q), (rev, fte) =>
      fte === 0 ? null : rev / fte,
    );
  }

  const cash = cashByPeriod(db, q.filters);
  if (q.metric === "net_burn") {
    return toRows(cash.map((r) => ({ key: r.period, value: r.burn })));
  }
  if (q.metric === "runway_months") {
    return toRows(
      cash.flatMap((row, i) => {
        const window = cash.slice(Math.max(0, i - 2), i + 1);
        const avgBurn = window.reduce((sum, r) => sum + r.burn, 0) / window.length;
        const months = runwayMonths(row.balance, avgBurn);
        return months == null ? [] : [{ key: row.period, value: months }];
      }),
    );
  }
  if (q.metric === "burn_vs_budget") {
    const actual = cashByPeriod(db, { ...q.filters, scenario: "actual" });
    const budget = cashByPeriod(db, { ...q.filters, scenario: "budget" });
    return mergeByKey(
      toRows(actual.map((r) => ({ key: r.period, value: r.burn }))),
      toRows(budget.map((r) => ({ key: r.period, value: r.burn }))),
      (a, b) => a - b,
    );
  }

  const arr = arrByPeriod(db, q.filters);
  if (q.metric === "arr") {
    return toRows(arr.map((r) => ({ key: r.period, value: r.ending })));
  }
  if (q.metric === "mrr") {
    return toRows(arr.map((r) => ({ key: r.period, value: mrrFromArr(r.ending) })));
  }
  if (q.metric === "net_new_arr") {
    return toRows(arr.map((r) => ({ key: r.period, value: r.netNew })));
  }
  if (q.metric === "nrr") {
    return toRows(
      arr.flatMap((r) => {
        const value = nrr(r.beginning, r.expansion, r.contraction, r.churn);
        return value == null ? [] : [{ key: r.period, value }];
      }),
    );
  }
  if (q.metric === "grr") {
    return toRows(
      arr.flatMap((r) => {
        const value = grr(r.beginning, r.contraction, r.churn);
        return value == null ? [] : [{ key: r.period, value }];
      }),
    );
  }
  if (q.metric === "rule_of_40") {
    const ebitda = queryCube(db, { ...q, metric: "ebitda", grain: "period" });
    const revenue = revenueRows(db, { ...q, grain: "period" });
    const arrMap = new Map(arr.map((r) => [r.period, r.ending]));
    return toRows(
      arr.flatMap((r) => {
        const prior = arrMap.get(yearAgo(r.period));
        if (!prior || prior === 0) return [];
        const growth = ((r.ending - prior) / prior) * 100;
        const rev = revenue.find((row) => row.key === r.period)?.value ?? 0;
        const e = ebitda.find((row) => row.key === r.period)?.value ?? 0;
        if (rev === 0) return [];
        return [{ key: r.period, value: growth + (e / rev) * 100 }];
      }),
    );
  }
  if (q.metric === "burn_multiple") {
    const burns = new Map(cash.map((r) => [r.period, r.burn]));
    return toRows(
      arr.flatMap((r) => {
        if (r.netNew <= 0) return [];
        const burn = burns.get(r.period);
        if (burn == null) return [];
        return [{ key: r.period, value: burn / r.netNew }];
      }),
    );
  }
  if (q.metric === "magic_number") {
    const sm = smByPeriod(db, q.filters);
    return toRows(
      arr.flatMap((r) => {
        const spend = sm.get(priorPeriod(r.period));
        if (spend == null || spend <= 0) return [];
        return [{ key: r.period, value: r.netNew / spend }];
      }),
    );
  }

  return [];
}
