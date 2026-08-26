"use client";

import { useCallback, useEffect, useState } from "react";
import { NavigableChart } from "@/components/dashboard/NavigableChart";
import { usePortalMode } from "@/components/shell/AppShell";
import type { CubeQuery, CubeRow } from "@/lib/cube/query";
import type { Dashboard } from "@/lib/dashboards/store";

const defaultQuery: CubeQuery = {
  metric: "revenue",
  grain: "period",
  filters: { scenario: "actual" },
};

export function CloseCanvas() {
  const mode = usePortalMode();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [periods, setPeriods] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<CubeQuery>(defaultQuery);
  const [rows, setRows] = useState<CubeRow[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/dashboards?id=org-close");
    if (res.ok) setDashboard((await res.json()) as Dashboard);
  }, []);

  const runCube = useCallback(async (q: CubeQuery) => {
    const res = await fetch("/api/cube", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(q),
    });
    if (!res.ok) return;
    const body = (await res.json()) as { rows: CubeRow[] };
    setRows(body.rows);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function loadPack() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pack/load", { method: "POST" });
      if (!res.ok) throw new Error("Could not load the sample pack");
      const body = (await res.json()) as { periods: number };
      setPeriods(body.periods);
      await refresh();
      const next = defaultQuery;
      setQuery(next);
      await runCube(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="close-head">
        <h1>Northstar Close</h1>
        <button type="button" onClick={() => void loadPack()} disabled={loading}>
          {loading ? "Loading…" : "Load sample pack"}
        </button>
      </div>
      {error ? <p className="error">{error}</p> : null}
      {periods != null ? <p>{periods} periods in the cube.</p> : null}
      {rows.length ? (
        <NavigableChart
          query={query}
          rows={rows}
          onQueryChange={(q) => {
            setQuery(q);
            void runCube(q);
          }}
        />
      ) : (
        <p className="empty">
          No widgets on the org board yet. Load the sample pack to open a navigable
          revenue chart. Click a bar to drill; use Up to go back.
        </p>
      )}
      {dashboard?.widgets.length ? (
        <ul>
          {dashboard.widgets.map((w) => (
            <li
              key={w.id}
              {...(mode === "edit" ? { "data-draggable": "true" } : {})}
            >
              <strong>{w.title}</strong>
              {w.note ? <span> — {w.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
