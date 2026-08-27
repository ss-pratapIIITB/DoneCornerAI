import type { DashboardSpec, DashboardWidgetSpec } from "@/lib/dashboards/dsl";
import type {
  Dashboard,
  Widget,
  WidgetType,
} from "@/lib/dashboards/widgets";

export type DashboardAdaptOptions = {
  id?: string;
  owner: string;
  forkedFrom?: string | null;
};

const RENDERER_WIDGET_TYPES: Record<
  DashboardWidgetSpec["primitive"],
  WidgetType
> = {
  kpi: "kpi",
  variance_kpi: "kpi",
  bar: "bar",
  stacked_bar: "bar",
  line: "line",
  waterfall: "bar",
  pnl_table: "pnl_table",
  exception_queue: "table",
  markdown_insight: "table",
};

export function adaptDashboardWidget(spec: DashboardWidgetSpec): Widget {
  const query = {
    metric: spec.query.metric,
    grain: spec.query.grain,
    filters: { ...spec.query.filters },
  };
  return {
    id: spec.id,
    type: RENDERER_WIDGET_TYPES[spec.primitive],
    title: spec.title,
    query,
    note: "",
    layout: { ...spec.position },
    lake: query,
    primitive: spec.primitive,
    rendererVersion: spec.rendererVersion,
    purpose: spec.purpose,
    whyThisVisualization: spec.whyThisVisualization,
    dataShape: spec.dataShape,
    pointLimit: spec.pointLimit,
    drillPath: [...spec.drill.path],
    provenance: {
      runId: spec.provenance.runId,
      eventIds: [...spec.provenance.eventIds],
      artifactIds: [...spec.provenance.artifactIds],
    },
  };
}

export function adaptDashboardSpec(
  spec: DashboardSpec,
  options: DashboardAdaptOptions,
): Dashboard {
  return {
    id: options.id ?? spec.id ?? "preview-dashboard",
    name: spec.name,
    owner: options.owner,
    forkedFrom: options.forkedFrom ?? null,
    widgets: spec.widgets.map(adaptDashboardWidget),
  };
}
