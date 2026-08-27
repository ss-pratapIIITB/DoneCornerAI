export const ENTITY_LEVELS = [
  "group",
  "vertical",
  "company",
  "category",
  "product",
] as const;

export type EntityLevel = (typeof ENTITY_LEVELS)[number];

export const LAKE_GRAINS = ["period", "account", ...ENTITY_LEVELS] as const;
export type LakeGrain = (typeof LAKE_GRAINS)[number];

export function parseLakeGrain(value: unknown): LakeGrain {
  if (
    typeof value !== "string" ||
    !LAKE_GRAINS.includes(value as LakeGrain)
  ) {
    throw new Error("Invalid lake grain");
  }
  return value as LakeGrain;
}

export type LakeFilters = {
  group?: string;
  vertical?: string;
  company?: string;
  category?: string;
  product?: string;
  period?: string[];
  account?: string[];
  scenario?: "actual" | "budget";
};

export type LakeQuery = {
  metric: string;
  grain: LakeGrain;
  filters: LakeFilters;
};

export type LakeRow = { key: string; label: string; value: number };

export const ACCOUNTS = [
  "revenue",
  "cogs",
  "sm",
  "rd",
  "ga",
  "capex_tech",
  "ap",
  "net_income",
  "cash_in",
  "cash_out",
] as const;

export type AccountId = (typeof ACCOUNTS)[number];
