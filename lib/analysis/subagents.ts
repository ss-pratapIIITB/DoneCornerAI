import type { DatabaseSync } from "node:sqlite";
import { queryCube } from "@/lib/cube/query";

export type SubagentSlice = {
  name: "P&L" | "Cash" | "Growth";
  metric: "revenue" | "net_burn" | "arr";
  rows: { key: string; label: string; value: number }[];
};

export type CloseSubagents = {
  pnl: SubagentSlice;
  cash: SubagentSlice;
  growth: SubagentSlice;
};

export async function runCloseSubagents(
  db: DatabaseSync,
): Promise<CloseSubagents> {
  const [pnl, cash, growth] = await Promise.all([
    Promise.resolve({
      name: "P&L" as const,
      metric: "revenue" as const,
      rows: queryCube(db, {
        metric: "revenue",
        grain: "period",
        filters: { scenario: "actual" },
      }),
    }),
    Promise.resolve({
      name: "Cash" as const,
      metric: "net_burn" as const,
      rows: queryCube(db, {
        metric: "net_burn",
        grain: "period",
        filters: { scenario: "actual" },
      }),
    }),
    Promise.resolve({
      name: "Growth" as const,
      metric: "arr" as const,
      rows: queryCube(db, {
        metric: "arr",
        grain: "period",
        filters: {},
      }),
    }),
  ]);
  return { pnl, cash, growth };
}
