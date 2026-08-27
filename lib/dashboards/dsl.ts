import type { LakeGrain, LakeQuery } from "@/lib/lake/types";

export const DASHBOARD_DSL_VERSION = 1 as const;
export const DASHBOARD_RENDERER_VERSION = 1 as const;

export const DASHBOARD_PRIMITIVE_IDS = [
  "kpi",
  "variance_kpi",
  "bar",
  "stacked_bar",
  "line",
  "waterfall",
  "pnl_table",
  "exception_queue",
  "markdown_insight",
] as const;

export type DashboardPrimitiveId = (typeof DASHBOARD_PRIMITIVE_IDS)[number];

export const DASHBOARD_DATA_SHAPES = [
  "scalar",
  "variance",
  "series",
  "grouped_series",
  "bridge",
  "table",
  "records",
  "markdown",
] as const;

export type DashboardDataShape = (typeof DASHBOARD_DATA_SHAPES)[number];
export type DashboardDensity = "compact" | "standard";

export type DashboardPosition = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type DashboardProvenance = {
  runId: string;
  eventIds: string[];
  artifactIds: string[];
};

export type DashboardWidgetSpec = {
  id: string;
  primitive: DashboardPrimitiveId;
  rendererVersion: typeof DASHBOARD_RENDERER_VERSION;
  title: string;
  purpose: string;
  whyThisVisualization: string;
  dataShape: DashboardDataShape;
  pointLimit: number;
  query: LakeQuery;
  drill: { path: LakeGrain[] };
  position: DashboardPosition;
  provenance: DashboardProvenance;
};

export type DashboardSpecV1 = {
  version: typeof DASHBOARD_DSL_VERSION;
  id?: string;
  name: string;
  purpose: string;
  layout: {
    columns: number;
    density: DashboardDensity;
  };
  widgets: DashboardWidgetSpec[];
};

export type DashboardSpec = DashboardSpecV1;
