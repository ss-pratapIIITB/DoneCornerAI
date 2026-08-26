import type { DatabaseSync } from "node:sqlite";
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

function grainColumn(grain: Grain): string {
  if (grain === "period") return "period";
  if (grain === "function") return "function";
  return "account";
}

function whereClause(filters: CubeFilters, extra: string[] = []): { sql: string; params: unknown[] } {
  const clauses = [...extra];
  const params: unknown[] = [];
  const scenario = filters.scenario ?? "actual";
  clauses.push("scenario = ?");
  params.push(scenario);
  if (filters.period?.length) {
    clauses.push(`period IN (${filters.period.map(() => "?").join(",")})`);
    params.push(...filters.period);
  }
  if (filters.function?.length) {
    clauses.push(`function IN (${filters.function.map(() => "?").join(",")})`);
    params.push(...filters.function);
  }
  if (filters.account?.length) {
    clauses.push(`account IN (${filters.account.map(() => "?").join(",")})`);
    params.push(...filters.account);
  }
  if (filters.entity?.length) {
    clauses.push(`entity IN (${filters.entity.map(() => "?").join(",")})`);
    params.push(...filters.entity);
  }
  return { sql: clauses.length ? `WHERE ${clauses.join(" AND ")}` : "", params };
}

export function queryCube(db: DatabaseSync, q: CubeQuery): CubeRow[] {
  const col = grainColumn(q.grain);
  const extra: string[] = [];
  if (q.metric === "revenue" || q.metric === "gross_profit" || q.metric === "gross_margin_pct") {
    extra.push(`account IN (${REVENUE_ACCOUNTS.map(() => "?").join(",")})`);
  }
  if (q.metric === "cogs") extra.push("function = 'cogs'");
  if (q.metric === "opex") extra.push("function IN ('sm','rd','ga')");

  const extraParams =
    q.metric === "revenue" || q.metric === "gross_profit" || q.metric === "gross_margin_pct"
      ? [...REVENUE_ACCOUNTS]
      : [];
  const { sql, params } = whereClause(q.filters, extra);
  const allParams = [...extraParams, ...params];

  if (q.metric === "arr" || q.metric === "mrr" || q.metric === "net_new_arr") {
    const colArr = q.grain === "period" ? "period" : "entity";
    const expr =
      q.metric === "arr"
        ? "SUM(ending_arr)"
        : q.metric === "mrr"
          ? "SUM(ending_arr)/12.0"
          : "SUM(new + expansion - contraction - churn)";
    const { sql: w, params: p } = whereClause(q.filters);
    const rows = db
      .prepare(
        `SELECT ${colArr} AS key, ${expr} AS value FROM facts_arr ${w} GROUP BY ${colArr} ORDER BY key`,
      )
      .all(...p) as { key: string; value: number }[];
    return rows.map((r) => ({ key: String(r.key), label: String(r.key), value: Number(r.value) }));
  }

  if (q.metric === "net_burn" || q.metric === "runway_months") {
    const { sql: w, params: p } = whereClause(q.filters);
    const rows = db
      .prepare(
        `SELECT period AS key, SUM(cash_out - cash_in) AS value FROM facts_cash ${w} GROUP BY period ORDER BY key`,
      )
      .all(...p) as { key: string; value: number }[];
    return rows.map((r) => ({ key: String(r.key), label: String(r.key), value: Number(r.value) }));
  }

  const rows = db
    .prepare(
      `SELECT ${col} AS key, SUM(amount) AS value FROM facts_pnl ${sql} GROUP BY ${col} ORDER BY key`,
    )
    .all(...allParams) as { key: string; value: number }[];

  return rows.map((r) => ({
    key: String(r.key),
    label: String(r.key),
    value: Number(r.value),
  }));
}
