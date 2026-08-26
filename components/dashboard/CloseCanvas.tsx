"use client";

import { useCallback, useEffect, useState } from "react";
import { NavigableChart } from "@/components/dashboard/NavigableChart";
import { WidgetNote } from "@/components/dashboard/WidgetNote";
import { usePortal, usePortalMode } from "@/components/shell/AppShell";
import type { CubeQuery, CubeRow } from "@/lib/cube/query";

const defaultQuery: CubeQuery = {
  metric: "revenue",
  grain: "period",
  filters: { scenario: "actual" },
};

export function CloseCanvas() {
  const mode = usePortalMode();
  const { board, requestPublish, setAgent } = usePortal();
  const [periods, setPeriods] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState<CubeQuery>(defaultQuery);
  const [rows, setRows] = useState<CubeRow[]>([]);

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

  async function loadPack() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/pack/load", { method: "POST" });
      if (!res.ok) throw new Error("Could not load the sample pack");
      const body = (await res.json()) as { periods: number };
      setPeriods(body.periods);
      const next = defaultQuery;
      setQuery(next);
      await runCube(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (board?.widgets.some((w) => w.type === "bar")) {
      const first = board.widgets.find((w) => w.type === "bar");
      if (first) void runCube(first.query);
    }
  }, [board, runCube]);

  return (
    <section>
      <div className="close-head">
        <h1>{board?.name ?? "Northstar Close"}</h1>
        <button type="button" onClick={() => void loadPack()} disabled={loading}>
          {loading ? "Loading…" : "Load sample pack"}
        </button>
        {mode === "edit" ? (
          <button type="button" onClick={() => void requestPublish()}>
            Publish to org
          </button>
        ) : null}
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
      <label className="upload">
        Drop a CSV/Excel close file
        <input
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
              const buf = reader.result;
              if (!(buf instanceof ArrayBuffer)) return;
              const bytes = btoa(
                String.fromCharCode(...new Uint8Array(buf)),
              );
              void fetch("/api/pack/upload", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ filename: file.name, bytes }),
              }).then(async (res) => {
                const body = (await res.json()) as {
                  error?: string;
                  instruction?: string;
                };
                if (!res.ok) {
                  setError(body.error ?? "Upload rejected");
                  setAgent("error", body.error ?? "Upload rejected");
                  return;
                }
                setError(null);
                setAgent(
                  "running",
                  body.instruction ?? "File stored for sandbox clean.",
                );
              });
            };
            reader.readAsArrayBuffer(file);
          }}
        />
      </label>
      {board?.widgets.length ? (
        <ul className="widget-list">
          {board.widgets.map((w) => (
            <li
              key={w.id}
              className="widget-card"
              {...(mode === "edit" ? { "data-draggable": "true" } : {})}
            >
              <strong>{w.title}</strong>
              <span className="empty"> · {w.type}</span>
              <WidgetNote widget={w} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
