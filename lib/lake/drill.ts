import type { LakeGrain, LakeQuery } from "@/lib/lake/types";
import { ENTITY_LEVELS } from "@/lib/lake/types";

export function nextLakeGrain(grain: LakeGrain): LakeGrain | null {
  if (grain === "period") return "group";
  const i = ENTITY_LEVELS.indexOf(grain as (typeof ENTITY_LEVELS)[number]);
  if (i >= 0 && i < ENTITY_LEVELS.length - 1) return ENTITY_LEVELS[i + 1];
  if (grain === "product") return "account";
  return null;
}

export function prevLakeGrain(grain: LakeGrain): LakeGrain | null {
  if (grain === "account") return "product";
  if (grain === "group") return "period";
  const i = ENTITY_LEVELS.indexOf(grain as (typeof ENTITY_LEVELS)[number]);
  if (i > 0) return ENTITY_LEVELS[i - 1];
  return null;
}

export function drillLake(q: LakeQuery, key: string): LakeQuery {
  const next = nextLakeGrain(q.grain);
  if (!next) return q;
  const filters = { ...q.filters };
  if (q.grain === "period") filters.period = [key];
  else if (q.grain === "account") filters.account = [key];
  else filters[q.grain] = key;
  return { ...q, grain: next, filters };
}

export function drillLakeUp(q: LakeQuery): LakeQuery {
  const prev = prevLakeGrain(q.grain);
  if (!prev) return q;
  const filters = { ...q.filters };
  if (q.grain === "group") delete filters.period;
  else if (q.grain === "account") delete filters.product;
  else if (prev !== "period" && prev !== "account") delete filters[prev];
  return { ...q, grain: prev, filters };
}

export function drillPnlCell(q: LakeQuery, period: string, account: string): LakeQuery {
  return {
    ...q,
    metric: account,
    grain: "group",
    filters: { ...q.filters, period: [period], account: [account] },
  };
}
