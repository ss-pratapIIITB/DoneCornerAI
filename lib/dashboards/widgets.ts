import { describeSchema } from "@/lib/cube/schema";
import type { CubeQuery } from "@/lib/cube/query";
import type { MetricId } from "@/lib/cube/types";
import type {
  DashboardDataShape,
  DashboardPrimitiveId,
  DashboardProvenance,
} from "@/lib/dashboards/dsl";
import type { LakeGrain, LakeQuery } from "@/lib/lake/types";

export type WidgetType =
  | "kpi"
  | "variance_kpi"
  | "bar"
  | "stacked_bar"
  | "line"
  | "waterfall"
  | "table"
  | "pnl_table"
  | "exception_queue"
  | "markdown_insight";

export type WidgetLayout = { x?: number; y?: number; w: number; h: number };

export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  query: CubeQuery | LakeQuery;
  note: string;
  layout?: WidgetLayout;
  lake?: LakeQuery;
  primitive?: DashboardPrimitiveId;
  rendererVersion?: number;
  purpose?: string;
  whyThisVisualization?: string;
  dataShape?: DashboardDataShape;
  pointLimit?: number;
  drillPath?: LakeGrain[];
  provenance?: DashboardProvenance;
};

export type Dashboard = {
  id: string;
  name: string;
  owner: "org" | string;
  forkedFrom: string | null;
  widgets: Widget[];
};

export function widgetFromMetric(metric: MetricId, type: WidgetType): Widget {
  const def = describeSchema().metrics.find((m) => m.id === metric);
  if (!def) throw new Error(`Unknown metric ${metric}`);
  return {
    id: `w-${metric}-${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`,
    type,
    title: metric,
    query: {
      metric,
      grain: def.grain,
      filters: { scenario: "actual" },
    },
    note: "",
  };
}

export function setWidgetNote(
  dashboard: Dashboard,
  widgetId: string,
  note: string,
): Dashboard {
  return {
    ...dashboard,
    widgets: dashboard.widgets.map((w) =>
      w.id === widgetId ? { ...w, note } : w,
    ),
  };
}
