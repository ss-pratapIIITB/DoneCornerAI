"use client";

import { useState } from "react";
import { usePortal, usePortalMode } from "@/components/shell/AppShell";
import { describeSchema } from "@/lib/cube/schema";
import type { MetricId } from "@/lib/cube/types";
import { widgetFromMetric, type WidgetType } from "@/lib/dashboards/widgets";

type Props = {
  schema: ReturnType<typeof describeSchema>;
};

export function SchemaExplorer({ schema }: Props) {
  const mode = usePortalMode();
  const { enterEdit, saveBoard } = usePortal();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addMetric(metric: MetricId, type: WidgetType) {
    setError(null);
    try {
      const board = await enterEdit();
      const widget = widgetFromMetric(metric, type);
      await saveBoard({ ...board, widgets: [...board.widgets, widget] });
      setMessage(`Added ${metric} as ${type} to the personal board.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add widget");
    }
  }

  return (
    <div className="schema-page">
      <h1>Schema</h1>
      <p className="empty">
        Cube tables stay for uploads. The live warehouse is Postgres: entities
        (group → vertical → company → category → product) and facts (period,
        account, amount, scenario). Ask the agent to <code>query_sql</code> or
        <code>present_chart</code>.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="ok">{message}</p> : null}

      {schema.tables.map((table) => (
        <section key={table.name} className="schema-table">
          <h2>{table.name}</h2>
          <p className="empty">{table.grain}</p>
          <p>{table.columns.join(", ")}</p>
        </section>
      ))}

      <h2>Metrics</h2>
      <ul className="metric-list">
        {schema.metrics.map((m) => (
          <li key={m.id}>
            <div>
              <strong>{m.id}</strong>
              <span> — {m.description}</span>
            </div>
            {mode === "edit" ? (
              <div className="metric-actions">
                <button
                  type="button"
                  onClick={() => void addMetric(m.id, "kpi")}
                >
                  Add {m.id} as KPI
                </button>
                <button
                  type="button"
                  onClick={() => void addMetric(m.id, "bar")}
                >
                  Add {m.id} as bar
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
