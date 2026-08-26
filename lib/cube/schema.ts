import type { Grain, MetricId } from "@/lib/cube/types";

export function describeSchema(): {
  tables: { name: string; grain: string; columns: string[] }[];
  metrics: { id: MetricId; grain: Grain; description: string }[];
} {
  return {
    tables: [
      {
        name: "facts_pnl",
        grain: "period + entity + function + account",
        columns: [
          "period",
          "entity",
          "function",
          "account",
          "amount",
          "currency",
          "scenario",
          "source",
        ],
      },
      {
        name: "facts_cash",
        grain: "period + entity",
        columns: [
          "period",
          "entity",
          "cash_in",
          "cash_out",
          "ending_balance",
          "scenario",
          "source",
        ],
      },
      {
        name: "facts_arr",
        grain: "period + entity",
        columns: [
          "period",
          "entity",
          "beginning_arr",
          "new",
          "expansion",
          "contraction",
          "churn",
          "ending_arr",
          "source",
        ],
      },
      {
        name: "facts_headcount",
        grain: "period + entity + function",
        columns: ["period", "entity", "function", "fte", "scenario", "source"],
      },
    ],
    metrics: [
      { id: "revenue", grain: "period", description: "Subscription revenue" },
      { id: "cogs", grain: "period", description: "Cost of revenue" },
      { id: "gross_margin_pct", grain: "period", description: "Gross margin %" },
      { id: "opex", grain: "function", description: "Operating expenses" },
      { id: "net_burn", grain: "period", description: "Cash out minus cash in" },
      { id: "runway_months", grain: "period", description: "Months of cash at burn" },
      { id: "arr", grain: "period", description: "Ending ARR" },
      { id: "nrr", grain: "period", description: "Net revenue retention" },
    ],
  };
}
