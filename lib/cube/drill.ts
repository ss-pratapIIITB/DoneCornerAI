import type { FunctionCode } from "@/lib/cube/types";
import type { CubeQuery } from "@/lib/cube/query";
import type { Grain } from "@/lib/cube/types";

export function nextGrain(grain: Grain): Grain | null {
  if (grain === "period") return "function";
  if (grain === "function") return "account";
  return null;
}

export function prevGrain(grain: Grain): Grain | null {
  if (grain === "account") return "function";
  if (grain === "function") return "period";
  return null;
}

export function drillDown(q: CubeQuery, clickedKey: string): CubeQuery {
  const next = nextGrain(q.grain);
  if (!next) return q;
  const filters = { ...q.filters };
  if (q.grain === "period") filters.period = [clickedKey];
  if (q.grain === "function") filters.function = [clickedKey as FunctionCode];
  if (q.grain === "account") filters.account = [clickedKey];
  return { ...q, grain: next, filters };
}

export function drillUp(q: CubeQuery): CubeQuery {
  const prev = prevGrain(q.grain);
  if (!prev) return q;
  const filters = { ...q.filters };
  if (q.grain === "function") delete filters.period;
  if (q.grain === "account") delete filters.function;
  return { ...q, grain: prev, filters };
}
