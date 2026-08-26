"use client";

import { useCallback, useEffect, useState } from "react";
import { usePortalMode } from "@/components/shell/AppShell";
import type { Dashboard } from "@/lib/dashboards/store";

export function CloseCanvas() {
  const mode = usePortalMode();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [periods, setPeriods] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/dashboards?id=org-close");
    if (res.ok) setDashboard((await res.json()) as Dashboard);
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
      {dashboard?.widgets.length ? (
        <ul>
          {dashboard.widgets.map((w) => (
            <li key={w.id} {...(mode === "edit" ? { "data-draggable": "true" } : {})}>
              <strong>{w.title}</strong>
              {w.note ? <span> — {w.note}</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="empty">
          No widgets on the org board yet. Load the pack, then ask the agent to draft
          Close, or switch to Edit to fork a personal board.
        </p>
      )}
    </section>
  );
}
