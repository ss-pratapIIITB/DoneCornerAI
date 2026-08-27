"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { LakeQuery, LakeRow } from "@/lib/lake/types";
import { ENTITY_LEVELS } from "@/lib/lake/types";
import { drillLake, drillLakeUp, prevLakeGrain } from "@/lib/lake/drill";

type Props = {
  query: LakeQuery;
  rows: LakeRow[];
  onQueryChange: (q: LakeQuery) => void;
};

export function LakeChart({ query, rows, onQueryChange }: Props) {
  const canUp = prevLakeGrain(query.grain) != null;
  const ancestors = [
    ...(query.filters.period ?? []).map((value) => `period ${value}`),
    ...ENTITY_LEVELS.flatMap((level) =>
      query.filters[level] ? [`${level} ${query.filters[level]}`] : [],
    ),
  ];
  return (
    <div className="chart-block" data-grain={query.grain}>
      <nav className="breadcrumbs" aria-label="Chart drill path">
        {canUp ? (
          <button type="button" onClick={() => onQueryChange(drillLakeUp(query))}>
            Up
          </button>
        ) : null}
        <span>{query.metric}</span>
        {ancestors.map((ancestor) => (
          <span key={ancestor}>/ {ancestor}</span>
        ))}
        <strong>/ by {query.grain}</strong>
      </nav>
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={rows}
            onClick={(state) => {
              const key = state?.activeLabel;
              if (typeof key === "string") onQueryChange(drillLake(query, key));
            }}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--line)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={56}
            />
            <Tooltip
              cursor={{ fill: "var(--surface-raised)" }}
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--line)",
                borderRadius: 0,
              }}
              labelStyle={{ color: "var(--paper)" }}
            />
            <Bar
              dataKey="value"
              fill="var(--blue)"
              radius={[2, 2, 0, 0]}
              cursor="pointer"
              isAnimationActive={false}
              onClick={(data) => {
                const key = (data as { payload?: LakeRow }).payload?.key;
                if (key) onQueryChange(drillLake(query, key));
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
              onClick={() => onQueryChange(drillLake(query, row.key))}
            >
              {row.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
