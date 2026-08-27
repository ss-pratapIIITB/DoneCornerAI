"use client";

import { useEffect, useState } from "react";
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MarkdownReply } from "@/components/shell/MarkdownReply";
import { WidgetFrame, downloadCsv } from "@/components/dashboard/WidgetFrame";
import { WidgetNote } from "@/components/dashboard/WidgetNote";
import { drillLake, drillLakeUp } from "@/lib/lake/drill";
import { DASHBOARD_PRIMITIVES_V1 } from "@/lib/dashboards/primitives";
import type { DashboardPrimitiveId } from "@/lib/dashboards/dsl";
import type { Widget } from "@/lib/dashboards/widgets";
import type { LakeQuery, LakeRow } from "@/lib/lake/types";

function lakeFromWidget(widget: Widget): LakeQuery {
  const lake = widget.lake;
  return {
    metric: String(lake?.metric ?? widget.query.metric),
    grain: lake?.grain ?? "period",
    filters: lake?.filters ?? { scenario: "actual" },
  };
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(value);
}

function nextDrillQuery(
  query: LakeQuery,
  key: string,
  path: Widget["drillPath"],
): LakeQuery | null {
  const index = path?.indexOf(query.grain) ?? -1;
  if (!path || index < 0 || index >= path.length - 1) return null;
  const next = drillLake(query, key);
  return next.grain === path[index + 1] ? next : null;
}

function previousDrillQuery(
  query: LakeQuery,
  path: Widget["drillPath"],
): LakeQuery | null {
  const index = path?.indexOf(query.grain) ?? -1;
  if (!path || index <= 0) return null;
  const previous = drillLakeUp(query);
  return previous.grain === path[index - 1] ? previous : null;
}

type PrimitiveContentProps = {
  primitive: DashboardPrimitiveId;
  widget: Widget;
  query: LakeQuery;
  rows: LakeRow[];
  onDrill: (key: string) => void;
  onDrillUp: (() => void) | undefined;
  canDrill: boolean;
};

function ChartNavigation({
  query,
  rows,
  onDrill,
  onDrillUp,
  canDrill,
}: Omit<PrimitiveContentProps, "primitive" | "widget">) {
  return (
    <>
      <nav className="breadcrumbs" aria-label="Generated chart drill path">
        {onDrillUp ? (
          <button type="button" onClick={onDrillUp}>
            Up
          </button>
        ) : null}
        <span>{query.metric}</span>
        <strong>/ by {query.grain}</strong>
      </nav>
      {canDrill ? (
        <ul className="drill-keys">
          {rows.map((row) => (
            <li key={row.key}>
              <button
                type="button"
                data-drill-action
                onClick={() => onDrill(row.key)}
              >
                {row.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function PrimitiveChart({
  primitive,
  query,
  rows,
  onDrill,
  onDrillUp,
  canDrill,
}: Omit<PrimitiveContentProps, "widget">) {
  const clickChart = (state: { activeLabel?: unknown } | null) => {
    if (canDrill && typeof state?.activeLabel === "string") {
      onDrill(state.activeLabel);
    }
  };
  const stacked = rows.map((row) => ({
    ...row,
    favorable: Math.max(0, row.value),
    unfavorable: Math.min(0, row.value),
  }));
  let cumulative = 0;
  const waterfall = rows.map((row) => {
    const start = cumulative;
    cumulative += row.value;
    return {
      ...row,
      range: [Math.min(start, cumulative), Math.max(start, cumulative)],
    };
  });
  const tooltipStyle = {
    background: "var(--panel)",
    border: "1px solid var(--line)",
    borderRadius: 0,
  };

  return (
    <div className="generated-chart">
      <div className="chart-frame">
        <ResponsiveContainer width="100%" height={280}>
          {primitive === "line" ? (
            <LineChart data={rows} onClick={clickChart}>
              <XAxis dataKey="label" />
              <YAxis width={56} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="var(--gold)"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          ) : (
            <BarChart
              data={
                primitive === "stacked_bar"
                  ? stacked
                  : primitive === "waterfall"
                    ? waterfall
                    : rows
              }
              onClick={clickChart}
            >
              <XAxis dataKey="label" />
              <YAxis width={56} />
              <Tooltip contentStyle={tooltipStyle} />
              {primitive === "stacked_bar" ? (
                <>
                  <Bar
                    dataKey="favorable"
                    stackId="value"
                    fill="var(--gold)"
                    isAnimationActive={false}
                  />
                  <Bar
                    dataKey="unfavorable"
                    stackId="value"
                    fill="var(--danger)"
                    isAnimationActive={false}
                  />
                </>
              ) : (
                <Bar
                  dataKey={primitive === "waterfall" ? "range" : "value"}
                  fill={primitive === "waterfall" ? "var(--gold)" : "var(--cyan)"}
                  radius={[2, 2, 0, 0]}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <ChartNavigation
        query={query}
        rows={rows}
        onDrill={onDrill}
        onDrillUp={onDrillUp}
        canDrill={canDrill}
      />
    </div>
  );
}

function PrimitiveContent(props: PrimitiveContentProps) {
  const { primitive, widget, rows, onDrill, onDrillUp, canDrill } =
    props;
  if (["bar", "stacked_bar", "line", "waterfall"].includes(primitive)) {
    return <PrimitiveChart {...props} />;
  }
  if (primitive === "kpi") {
    const row = rows[0];
    return (
      <div className="generated-kpi">
        <strong>{row ? formatValue(row.value) : "—"}</strong>
        {row && canDrill ? (
          <button type="button" data-drill-action onClick={() => onDrill(row.key)}>
            Drill into {row.label}
          </button>
        ) : null}
      </div>
    );
  }
  if (primitive === "variance_kpi") {
    const [baseline, actual] = rows;
    const variance = baseline && actual ? actual.value - baseline.value : null;
    return (
      <div className="generated-kpi generated-variance">
        <strong>{variance === null ? "—" : formatValue(variance)}</strong>
        <span>
          {baseline && actual
            ? `${actual.label} versus ${baseline.label}`
            : "Waiting for two comparison points"}
        </span>
        {actual && canDrill ? (
          <button type="button" data-drill-action onClick={() => onDrill(actual.key)}>
            Drill into variance
          </button>
        ) : null}
      </div>
    );
  }
  if (primitive === "pnl_table") {
    return (
      <div className="pnl-wrap">
        <table className="pnl-table">
          <thead>
            <tr>
              <th>Account / period</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <th>
                  {canDrill ? (
                    <button type="button" data-drill-action onClick={() => onDrill(row.key)}>
                      {row.label}
                    </button>
                  ) : (
                    row.label
                  )}
                </th>
                <td>{formatValue(row.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {onDrillUp ? (
          <button type="button" className="generated-up" onClick={onDrillUp}>
            Up one level
          </button>
        ) : null}
      </div>
    );
  }
  if (primitive === "exception_queue") {
    return (
      <ol className="generated-exceptions">
        {[...rows]
          .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))
          .map((row) => (
            <li key={row.key}>
              {canDrill ? (
                <button type="button" data-drill-action onClick={() => onDrill(row.key)}>
                  <span>{row.label}</span>
                  <strong>{formatValue(row.value)}</strong>
                </button>
              ) : (
                <>
                  <span>{row.label}</span>
                  <strong>{formatValue(row.value)}</strong>
                </>
              )}
            </li>
          ))}
      </ol>
    );
  }

  const row = rows[0];
  const liveEvidence = row
    ? `\n\n**Live evidence — ${row.label}:** ${formatValue(row.value)}`
    : "\n\n_Live evidence is loading._";
  return (
    <MarkdownReply>
      {`${widget.whyThisVisualization ?? widget.purpose ?? ""}${liveEvidence}`}
    </MarkdownReply>
  );
}

export function GeneratedDashboardWidget({ widget }: { widget: Widget }) {
  const primitive = widget.primitive;
  const definition = DASHBOARD_PRIMITIVES_V1.find(
    (candidate) => candidate.id === primitive,
  );
  const [query, setQuery] = useState<LakeQuery>(() => lakeFromWidget(widget));
  const [rows, setRows] = useState<LakeRow[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/lake/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("Lake query failed");
        return response.json();
      })
      .then((body: { rows?: LakeRow[] }) =>
        setRows((body.rows ?? []).slice(0, widget.pointLimit ?? definition?.maxPoints)),
      )
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(true);
      });
    return () => controller.abort();
  }, [definition?.maxPoints, query, widget.pointLimit]);

  if (!primitive || !definition) return null;
  const drillEnabled = definition.drillBehavior === "explicit_path";
  const drill = (key: string) => {
    const next = nextDrillQuery(query, key, widget.drillPath);
    if (next) {
      setError(false);
      setQuery(next);
    }
  };
  const previous = previousDrillQuery(query, widget.drillPath);
  const width = Math.max(40, Math.min(100, ((widget.layout?.w ?? 12) / 12) * 100));
  const height = Math.max(14, Math.min(56, (widget.layout?.h ?? 4) * 4));

  return (
    <WidgetFrame
      title={widget.title}
      defaultW={width}
      defaultH={height}
      allowPng={definition.export.png}
      onExportCsv={
        definition.export.csv
          ? () => downloadCsv(`${widget.title}.csv`, rows)
          : undefined
      }
    >
      <div
        className="generated-dashboard-widget"
        data-dashboard-primitive={primitive}
        data-renderer={primitive}
        data-drill-enabled={String(drillEnabled)}
        data-export-csv={String(definition.export.csv)}
        data-export-png={String(definition.export.png)}
      >
        <p className="generated-widget-purpose">{widget.purpose}</p>
        <p className="generated-widget-rationale">
          {widget.whyThisVisualization}
        </p>
        {error ? (
          <p className="error">Live lake data is unavailable. Retry the query.</p>
        ) : (
          <PrimitiveContent
            primitive={primitive}
            widget={widget}
            query={query}
            rows={rows}
            onDrill={drill}
            onDrillUp={previous ? () => setQuery(previous) : undefined}
            canDrill={
              drillEnabled &&
              nextDrillQuery(query, rows[0]?.key ?? "", widget.drillPath) !== null
            }
          />
        )}
        <footer className="generated-widget-provenance">
          Run {widget.provenance?.runId ?? "unavailable"}
        </footer>
      </div>
      <WidgetNote widget={widget} />
    </WidgetFrame>
  );
}
