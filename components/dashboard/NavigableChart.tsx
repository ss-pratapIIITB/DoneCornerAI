"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CubeQuery, CubeRow } from "@/lib/cube/query";
import { drillDown, drillUp, prevGrain } from "@/lib/cube/drill";

type Props = {
  query: CubeQuery;
  rows: CubeRow[];
  onQueryChange: (q: CubeQuery) => void;
};

export function NavigableChart({ query, rows, onQueryChange }: Props) {
  const canUp = prevGrain(query.grain) != null;

  return (
    <div className="chart-block" data-grain={query.grain}>
      <div className="breadcrumbs">
        {canUp ? (
          <button type="button" onClick={() => onQueryChange(drillUp(query))}>
            Up
          </button>
        ) : null}
        <span>
          {query.metric} by {query.grain}
          {query.filters.period?.length ? ` · ${query.filters.period.join(",")}` : ""}
          {query.filters.function?.length
            ? ` · ${query.filters.function.join(",")}`
            : ""}
        </span>
      </div>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={rows}
            onClick={(state) => {
              const key = state?.activeLabel;
              if (typeof key === "string") {
                onQueryChange(drillDown(query, key));
              }
            }}
          >
            <XAxis dataKey="label" tick={{ fill: "#b7c0c9", fontSize: 12 }} />
            <YAxis tick={{ fill: "#b7c0c9", fontSize: 12 }} />
            <Tooltip
              contentStyle={{ background: "#1c222b", border: "1px solid #2c3542" }}
            />
            <Bar
              dataKey="value"
              fill="#c4a35a"
              cursor="pointer"
              onClick={(data) => {
                const key = (data as { payload?: CubeRow }).payload?.key;
                if (key) onQueryChange(drillDown(query, key));
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="drill-keys">
        {rows.map((row) => (
          <li key={row.key}>
            <button
              type="button"
              data-drill-key={row.key}
              onClick={() => onQueryChange(drillDown(query, row.key))}
            >
              {row.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
