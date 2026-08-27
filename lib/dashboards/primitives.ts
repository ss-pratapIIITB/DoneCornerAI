import {
  DASHBOARD_DSL_VERSION,
  DASHBOARD_RENDERER_VERSION,
  type DashboardDataShape,
  type DashboardPrimitiveId,
} from "@/lib/dashboards/dsl";

export type DashboardDrillBehavior = "none" | "explicit_path";

export type DashboardPrimitiveDefinition = {
  id: DashboardPrimitiveId;
  label: string;
  dataShapes: DashboardDataShape[];
  maxPoints: number;
  drillBehavior: DashboardDrillBehavior;
  size: { minW: number; minH: number; maxW: number; maxH: number };
  export: { csv: boolean; png: boolean };
  accessibility: { requiresTitle: true; requiresPurpose: true };
  rendererVersion: typeof DASHBOARD_RENDERER_VERSION;
};

export type DashboardPrimitiveCatalog = {
  version: typeof DASHBOARD_DSL_VERSION;
  primitives: DashboardPrimitiveDefinition[];
};

export const DASHBOARD_PRIMITIVES_V1: readonly DashboardPrimitiveDefinition[] = [
  {
    id: "kpi",
    label: "KPI",
    dataShapes: ["scalar"],
    maxPoints: 1,
    drillBehavior: "explicit_path",
    size: { minW: 2, minH: 2, maxW: 6, maxH: 6 },
    export: { csv: true, png: false },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "variance_kpi",
    label: "Variance KPI",
    dataShapes: ["variance"],
    maxPoints: 2,
    drillBehavior: "explicit_path",
    size: { minW: 2, minH: 2, maxW: 6, maxH: 6 },
    export: { csv: true, png: false },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "bar",
    label: "Bar",
    dataShapes: ["series"],
    maxPoints: 50,
    drillBehavior: "explicit_path",
    size: { minW: 3, minH: 2, maxW: 12, maxH: 12 },
    export: { csv: true, png: true },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "stacked_bar",
    label: "Stacked bar",
    dataShapes: ["grouped_series"],
    maxPoints: 100,
    drillBehavior: "explicit_path",
    size: { minW: 4, minH: 3, maxW: 12, maxH: 12 },
    export: { csv: true, png: true },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "line",
    label: "Line",
    dataShapes: ["series", "grouped_series"],
    maxPoints: 120,
    drillBehavior: "explicit_path",
    size: { minW: 3, minH: 2, maxW: 12, maxH: 12 },
    export: { csv: true, png: true },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "waterfall",
    label: "Waterfall / bridge",
    dataShapes: ["bridge"],
    maxPoints: 30,
    drillBehavior: "explicit_path",
    size: { minW: 4, minH: 3, maxW: 12, maxH: 12 },
    export: { csv: true, png: true },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "pnl_table",
    label: "P&L table",
    dataShapes: ["table"],
    maxPoints: 240,
    drillBehavior: "explicit_path",
    size: { minW: 6, minH: 4, maxW: 12, maxH: 24 },
    export: { csv: true, png: false },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "exception_queue",
    label: "Exception queue",
    dataShapes: ["records"],
    maxPoints: 100,
    drillBehavior: "explicit_path",
    size: { minW: 4, minH: 3, maxW: 12, maxH: 24 },
    export: { csv: true, png: false },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
  {
    id: "markdown_insight",
    label: "Markdown insight",
    dataShapes: ["markdown"],
    maxPoints: 1,
    drillBehavior: "none",
    size: { minW: 3, minH: 2, maxW: 12, maxH: 12 },
    export: { csv: false, png: false },
    accessibility: { requiresTitle: true, requiresPurpose: true },
    rendererVersion: 1,
  },
];

export function listDashboardPrimitives(version: unknown): DashboardPrimitiveCatalog {
  if (version !== DASHBOARD_DSL_VERSION) {
    throw new Error(`Unsupported dashboard primitive catalog version ${String(version)}`);
  }
  return {
    version: DASHBOARD_DSL_VERSION,
    primitives: DASHBOARD_PRIMITIVES_V1.map((primitive) => ({
      ...primitive,
      dataShapes: [...primitive.dataShapes],
      size: { ...primitive.size },
      export: { ...primitive.export },
      accessibility: { ...primitive.accessibility },
    })),
  };
}
