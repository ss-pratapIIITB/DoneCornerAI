export const LAKE_METRIC_ACCOUNTS = {
  revenue: ["revenue"],
  cogs: ["cogs"],
  opex: ["sm", "rd", "ga"],
  sm: ["sm"],
  rd: ["rd"],
  ga: ["ga"],
  capex_tech: ["capex_tech"],
  ap: ["ap"],
  net_income: ["net_income"],
  cash_in: ["cash_in"],
  cash_out: ["cash_out"],
} as const;

export type LakeMetricAccounts = typeof LAKE_METRIC_ACCOUNTS;
export type LakeMetric = keyof LakeMetricAccounts;

export const LAKE_METRICS = Object.keys(
  LAKE_METRIC_ACCOUNTS,
) as LakeMetric[];

export function isLakeMetric(value: unknown): value is LakeMetric {
  return (
    typeof value === "string" &&
    Object.hasOwn(LAKE_METRIC_ACCOUNTS, value)
  );
}

export function accountsForLakeMetric(metric: LakeMetric): string[] {
  return [...LAKE_METRIC_ACCOUNTS[metric]];
}
