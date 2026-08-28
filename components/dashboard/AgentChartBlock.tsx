"use client";

import { useEffect, useState } from "react";
import { LakeChart } from "@/components/dashboard/LakeChart";
import { PinChartMenu } from "@/components/dashboard/PinChartMenu";
import { WidgetFrame, downloadCsv } from "@/components/dashboard/WidgetFrame";
import type { LakeQuery, LakeRow } from "@/lib/lake/types";

export type AgentChartSpec = {
  title: string;
  query: LakeQuery;
  rows?: LakeRow[];
};

type Props = {
  spec: AgentChartSpec;
  canPin: boolean;
  compact?: boolean;
  onPin: (boardId?: string) => Promise<void>;
};

export function AgentChartBlock({ spec, canPin, compact = false, onPin }: Props) {
  const [query, setQuery] = useState<LakeQuery>(spec.query);
  const [rows, setRows] = useState<LakeRow[]>(spec.rows ?? []);

  useEffect(() => {
    setQuery(spec.query);
    setRows(spec.rows ?? []);
  }, [spec]);

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
      allowResize={!compact}
      fill={compact}
      defaultH={compact ? 16 : 22}
      onExportCsv={() => downloadCsv(`${spec.title}.csv`, rows)}
    >
      {rows.length ? (
        <LakeChart
          query={query}
          rows={rows}
          compact={compact}
          onQueryChange={setQuery}
        />
      ) : (
        <p className="empty">
          No matching rows. Check period and entity filters.
        </p>
      )}
    </WidgetFrame>
  );
}
