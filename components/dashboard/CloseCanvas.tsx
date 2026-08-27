"use client";

import { useCallback, useEffect, useState } from "react";
import { LakeChart } from "@/components/dashboard/LakeChart";
import { GeneratedDashboardWidget } from "@/components/dashboard/GeneratedDashboardWidget";
import { PinChartMenu } from "@/components/dashboard/PinChartMenu";
import { PnlTable } from "@/components/dashboard/PnlTable";
import { WidgetFrame, downloadCsv } from "@/components/dashboard/WidgetFrame";
import { WidgetNote } from "@/components/dashboard/WidgetNote";
import { usePortal, usePortalMode } from "@/components/shell/AppShell";
import { drillLake, drillPnlCell } from "@/lib/lake/drill";
import type { LakeGrain, LakeQuery, LakeRow } from "@/lib/lake/types";
import type { Widget } from "@/lib/dashboards/widgets";

const defaultQuery: LakeQuery = {
  metric: "revenue",
  grain: "period",
  filters: { scenario: "actual" },
};

type PnlData = {
  periods: string[];
  accounts: string[];
  cells: Record<string, Record<string, number>>;
};

function compactUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function variancePct(actual: number, budget: number): number {
  if (!budget) return 0;
  return ((actual - budget) / Math.abs(budget)) * 100;
}

export function CloseCanvas() {
  const mode = usePortalMode();
  const { board, requestPublish, setAgent, lastCharts, pinChart } = usePortal();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<LakeQuery>(defaultQuery);
  const [rows, setRows] = useState<LakeRow[]>([]);
  const [facts, setFacts] = useState<number | null>(null);
  const [pnl, setPnl] = useState<PnlData | null>(null);
  const [budgetPnl, setBudgetPnl] = useState<PnlData | null>(null);

  const runLake = useCallback(async (q: LakeQuery, signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/lake/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(q),
        signal,
      });
      if (!res.ok) return;
      const body = (await res.json()) as { rows: LakeRow[] };
      setRows(body.rows ?? []);
    } catch (error) {
      if ((error as Error).name !== "AbortError") throw error;
    }
  }, []);

  const fetchPnl = useCallback(async (filters: LakeQuery["filters"], signal?: AbortSignal) => {
    try {
      const res = await fetch("/api/lake/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ view: "pnl", filters }),
        signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as PnlData;
    } catch (error) {
      if ((error as Error).name === "AbortError") return null;
      throw error;
    }
  }, []);

  const runPnl = useCallback(
    async (filters: LakeQuery["filters"], signal?: AbortSignal) => {
      const [actual, budget] = await Promise.all([
        fetchPnl({ ...filters, scenario: "actual" }, signal),
        fetchPnl({ ...filters, scenario: "budget" }, signal),
      ]);
      if (actual) setPnl(actual);
      if (budget) setBudgetPnl(budget);
    },
    [fetchPnl],
  );

  async function loadPack() {
    const confirmed = window.confirm(
      "Load the sample lake pack? This replaces current warehouse facts.",
    );
    if (!confirmed) return;
    setLoading(true);
    setError(null);
    try {
      await fetch("/api/pack/load", { method: "POST" });
      const res = await fetch("/api/lake/load", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not load the lake pack");
      }
      const body = (await res.json()) as { facts: number };
      setFacts(body.facts);
      await runLake(defaultQuery);
      await runPnl(defaultQuery.filters);
      setAgent("done", `Lake loaded. ${body.facts.toLocaleString()} fact rows in Postgres.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    // Fetch callbacks update state only after network responses resolve.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void runLake(query, controller.signal);
    void runPnl(query.filters, controller.signal);
    return () => controller.abort();
  }, [query, runLake, runPnl]);

  const latestPeriod = pnl?.periods.at(-1);
  const value = (data: PnlData | null, account: string) =>
    latestPeriod ? (data?.cells[account]?.[latestPeriod] ?? 0) : 0;
  const smVariance = value(pnl, "sm") - value(budgetPnl, "sm");
  const revenueVariance = variancePct(
    value(pnl, "revenue"),
    value(budgetPnl, "revenue"),
  );
  const exceptions = ["sm", "ap", "capex_tech"]
    .map((account) => ({
      account,
      actual: value(pnl, account),
      budget: value(budgetPnl, account),
      variance: variancePct(value(pnl, account), value(budgetPnl, account)),
    }))
    .sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance));

  return (
    <section className="close-board" data-signal-room>
      <div className="close-head">
        <div>
          <h1 suppressHydrationWarning>{board?.name ?? "Northstar Close"}</h1>
          <p>Exceptions first. Every signal traces back to the lake.</p>
        </div>
        <div className="close-actions">
          <button
            type="button"
            className="secondary-action"
            onClick={() => void loadPack()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Load sample pack"}
          </button>
          {mode === "edit" ? (
            <button type="button" onClick={() => void requestPublish()}>
              Publish to org
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="error">{error}</p> : null}

      <section className="signal-strip" aria-label="Close signals">
        <div className="primary-signal">
          <span>Primary exception</span>
          <strong>
            {latestPeriod
              ? `S&M is ${compactUsd(Math.abs(smVariance))} over plan`
              : "Load the lake to rank close exceptions"}
          </strong>
          <small>
            {latestPeriod
              ? `${latestPeriod} · Northstar Group · investigate with agent`
              : "Postgres + MCP will populate this signal room"}
          </small>
        </div>
        <div className="signal-stat">
          <span>Lake coverage</span>
          <strong>{pnl?.periods.length ?? 0}/12</strong>
          <small>{facts?.toLocaleString() ?? "Existing"} facts indexed</small>
        </div>
        <div className="signal-stat">
          <span>Net income</span>
          <strong>{latestPeriod ? compactUsd(value(pnl, "net_income")) : "—"}</strong>
          <small>
            {latestPeriod
              ? `${revenueVariance >= 0 ? "+" : ""}${revenueVariance.toFixed(1)}% revenue vs plan`
              : "Latest period"}
          </small>
        </div>
      </section>

      <div className="signal-workspace">
        <div className="signal-primary-chart">
          <WidgetFrame
            title={`${query.metric} · ${query.grain}`}
            allowResize={mode === "edit"}
            onExportCsv={() =>
              downloadCsv(`${query.metric}-${query.grain}.csv`, rows)
            }
          >
            {rows.length ? (
              <LakeChart query={query} rows={rows} onQueryChange={setQuery} />
            ) : (
              <p className="empty">
                Load the lake pack to open a navigable revenue chart.
              </p>
            )}
          </WidgetFrame>
        </div>

        <aside className="exception-queue">
          <div className="queue-head">
            <div>
              <h2>Exception queue</h2>
              <small>Ranked by variance</small>
            </div>
            <span>{latestPeriod ?? "Waiting"}</span>
          </div>
          {latestPeriod ? (
            <ol>
              {exceptions.map((item, index) => (
                <li key={item.account}>
                  <button
                    type="button"
                    onClick={() =>
                      setQuery({
                        ...query,
                        metric: item.account,
                        grain: "period",
                        filters: {
                          ...query.filters,
                          account: [item.account],
                        },
                      })
                    }
                  >
                    <span className="queue-rank">{String(index + 1).padStart(2, "0")}</span>
                    <span>
                      <strong>{item.account.replace("_", " ")}</strong>
                      <small>{compactUsd(item.actual)} actual</small>
                    </span>
                    <em>+{item.variance.toFixed(1)}%</em>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="queue-empty">
              Load the sample pack to rank S&amp;M, AP, and technology capex
              against budget.
            </p>
          )}
        </aside>
      </div>

      <div className="signal-pnl">
        <WidgetFrame title="P&L · actuals" defaultH={26} allowResize={mode === "edit"}>
          {pnl ? (
            <PnlTable
              periods={pnl.periods}
              accounts={pnl.accounts}
              cells={pnl.cells}
              onDrillPeriod={(period) =>
                setQuery(drillLake({ ...query, grain: "period" }, period))
              }
              onDrillAccount={(account) =>
                setQuery({
                  ...query,
                  metric: account,
                  grain: "period",
                  filters: { ...query.filters, account: [account] },
                })
              }
              onDrillCell={(period, account) =>
                setQuery(drillPnlCell(query, period, account))
              }
            />
          ) : (
            <p className="empty">P&amp;L fills after the lake pack loads.</p>
          )}
        </WidgetFrame>
      </div>

      {lastCharts.length || board?.widgets.length ? (
        <section className="saved-signals">
          <div className="saved-signals-head">
            <h2>Saved signals</h2>
          </div>
          {lastCharts.map((c, i) => (
            <AgentChartBlock
              key={`${c.title}-${i}`}
              spec={c}
              canPin={mode === "edit"}
              onPin={(boardId) => pinChart(c, boardId)}
            />
          ))}

          {board?.widgets.length ? (
            <div
              className="dashboard-widget-grid"
              style={{
                gridTemplateColumns: `repeat(${board.layout?.columns ?? 12}, minmax(0, 1fr))`,
              }}
            >
              {board.widgets.map((w) => {
                const columns = board.layout?.columns ?? 12;
                const x = w.layout?.x ?? 0;
                const y = w.layout?.y ?? 0;
                const span = w.layout?.w ?? columns;
                const height = w.layout?.h ?? 4;
                return (
                  <div
                    key={w.id}
                    className="dashboard-widget-slot"
                    data-dashboard-slot={w.id}
                    style={{
                      gridColumn: `${x + 1} / span ${span}`,
                      gridRow: `${y + 1} / span ${height}`,
                    }}
                  >
                    {w.lake && w.primitive ? (
                      <GeneratedDashboardWidget
                        key={`${w.id}:${w.primitive}:${JSON.stringify(w.lake ?? w.query)}`}
                        widget={w}
                        mode={mode}
                      />
                    ) : w.lake ? (
                      <PinnedLakeWidget widget={w} allowResize={mode === "edit"} />
                    ) : (
                      <article className="widget-card">
                        <strong>{w.title}</strong>
                        <span className="empty"> · {w.type}</span>
                        <WidgetNote widget={w} />
                      </article>
                    )}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>
      ) : null}
    </section>
  );
}

function lakeFromWidget(widget: Widget): LakeQuery {
  const lake = widget.lake;
  return {
    metric: String(lake?.metric ?? widget.query.metric),
    grain: (lake?.grain ?? "period") as LakeGrain,
    filters: (lake?.filters ?? { scenario: "actual" }) as LakeQuery["filters"],
  };
}

function PinnedLakeWidget({
  widget,
  allowResize,
}: {
  widget: Widget;
  allowResize: boolean;
}) {
  const [query, setQuery] = useState<LakeQuery>(lakeFromWidget(widget));
  const [rows, setRows] = useState<LakeRow[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/lake/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { rows: [] }))
      .then((body: { rows?: LakeRow[] }) => setRows(body.rows ?? []))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setRows([]);
      });
    return () => controller.abort();
  }, [query]);
  return (
    <WidgetFrame
      title={widget.title}
      fill
      allowResize={allowResize}
      onExportCsv={() => downloadCsv(`${widget.title}.csv`, rows)}
    >
      <LakeChart query={query} rows={rows} onQueryChange={setQuery} />
      <WidgetNote widget={widget} />
    </WidgetFrame>
  );
}

function AgentChartBlock({
  spec,
  canPin,
  onPin,
}: {
  spec: { title: string; query: LakeQuery };
  canPin: boolean;
  onPin: (boardId?: string) => Promise<void>;
}) {
  const [rows, setRows] = useState<LakeRow[]>([]);
  const [query, setQuery] = useState<LakeQuery>(spec.query);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/lake/query", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(query),
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { rows: [] }))
      .then((body: { rows?: LakeRow[] }) => setRows(body.rows ?? []))
      .catch((error: Error) => {
        if (error.name !== "AbortError") setRows([]);
      });
    return () => controller.abort();
  }, [query]);
  return (
    <WidgetFrame
      title={spec.title}
      extra={<PinChartMenu onPin={onPin} disabled={!canPin} />}
      allowResize={canPin}
      onExportCsv={() => downloadCsv(`${spec.title}.csv`, rows)}
    >
      <LakeChart query={query} rows={rows} onQueryChange={setQuery} />
    </WidgetFrame>
  );
}
