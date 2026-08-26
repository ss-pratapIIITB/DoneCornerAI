export type FunctionCode = "cogs" | "sm" | "rd" | "ga" | "other";
export type Scenario = "actual" | "budget" | "forecast";
export type Grain = "period" | "function" | "account";
export type MetricId =
  | "revenue"
  | "cogs"
  | "gross_profit"
  | "gross_margin_pct"
  | "opex"
  | "ebitda"
  | "opex_ratio"
  | "net_burn"
  | "runway_months"
  | "burn_vs_budget"
  | "bva_amount"
  | "bva_pct"
  | "arr"
  | "mrr"
  | "net_new_arr"
  | "nrr"
  | "grr"
  | "rule_of_40"
  | "burn_multiple"
  | "magic_number"
  | "rev_per_fte";
