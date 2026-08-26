import type { DatabaseSync } from "node:sqlite";
import { queryCube, type CubeQuery } from "@/lib/cube/query";

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

function startSlice(
  db: DatabaseSync,
  name: SubagentSlice["name"],
  metric: SubagentSlice["metric"],
  filters: CubeQuery["filters"],
): Promise<SubagentSlice> {
  return new Promise((resolve, reject) => {
    setImmediate(() => {
      try {
        resolve({
          name,
          metric,
          rows: queryCube(db, { metric, grain: "period", filters }),
        });
      } catch (err) {
        reject(err);
      }
    });
  });
}

export async function runCloseSubagents(
  db: DatabaseSync,
): Promise<CloseSubagents> {
  const [pnl, cash, growth] = await Promise.all([
    startSlice(db, "P&L", "revenue", { scenario: "actual" }),
    startSlice(db, "Cash", "net_burn", { scenario: "actual" }),
    startSlice(db, "Growth", "arr", {}),
  ]);
  return { pnl, cash, growth };
}
