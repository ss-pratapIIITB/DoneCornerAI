import {
  DASHBOARD_DATA_SHAPES,
  DASHBOARD_DSL_VERSION,
  DASHBOARD_PRIMITIVE_IDS,
  DASHBOARD_RENDERER_VERSION,
  type DashboardDataShape,
  type DashboardPosition,
  type DashboardPrimitiveId,
  type DashboardSpec,
  type DashboardWidgetSpec,
} from "@/lib/dashboards/dsl";
import {
  isRecord,
  normalizeBoundedString,
  normalizeIdentifier,
  normalizeLakeFilters,
  normalizeProvenance,
} from "@/lib/dashboards/guards";
import { DASHBOARD_PRIMITIVES_V1 } from "@/lib/dashboards/primitives";
import { nextLakeGrain } from "@/lib/lake/drill";
import { isLakeMetric } from "@/lib/lake/metrics";
import { LAKE_GRAINS, type LakeGrain } from "@/lib/lake/types";

export type DashboardFindingCode =
  | "invalid_dashboard"
  | "unsupported_dsl_version"
  | "unsupported_primitive"
  | "unsupported_renderer_version"
  | "unsupported_metric"
  | "unsupported_grain"
  | "unsupported_field"
  | "invalid_filter_value"
  | "arbitrary_code_not_allowed"
  | "incompatible_data_shape"
  | "excessive_points"
  | "missing_accessible_title"
  | "missing_accessible_purpose"
  | "invalid_widget_id"
  | "duplicate_widget_id"
  | "missing_visualization_rationale"
  | "invalid_drill_path"
  | "invalid_size"
  | "layout_out_of_bounds"
  | "layout_overlap"
  | "missing_provenance"
  | "invalid_provenance"
  | "query_execution_failed"
  | "actual_data_shape_mismatch"
  | "actual_point_limit_exceeded";

export type DashboardValidationFinding = {
  code: DashboardFindingCode;
  path: string;
  message: string;
  severity: "error";
};

export type DashboardValidationResult = {
  valid: boolean;
  findings: DashboardValidationFinding[];
};

export type DashboardSpecParseResult = DashboardValidationResult & {
  spec?: DashboardSpec;
};

function finding(
  code: DashboardFindingCode,
  path: string,
  message: string,
): DashboardValidationFinding {
  return { code, path, message, severity: "error" };
}

function isPrimitiveId(value: unknown): value is DashboardPrimitiveId {
  return (
    typeof value === "string" &&
    DASHBOARD_PRIMITIVE_IDS.includes(value as DashboardPrimitiveId)
  );
}

function isDataShape(value: unknown): value is DashboardDataShape {
  return (
    typeof value === "string" &&
    DASHBOARD_DATA_SHAPES.includes(value as DashboardDataShape)
  );
}

function isLakeGrain(value: unknown): value is LakeGrain {
  return (
    typeof value === "string" &&
    LAKE_GRAINS.includes(value as LakeGrain)
  );
}

function positionFrom(value: unknown): DashboardPosition | null {
  if (!isRecord(value)) return null;
  const { x, y, w, h } = value;
  if (![x, y, w, h].every(Number.isInteger)) return null;
  return { x: x as number, y: y as number, w: w as number, h: h as number };
}

function hasValidDrillPath(
  value: unknown,
  queryGrain: unknown,
  behavior: "none" | "explicit_path",
): value is LakeGrain[] {
  if (!Array.isArray(value) || !value.every(isLakeGrain)) return false;
  if (behavior === "none") return value.length === 0;
  if (!isLakeGrain(queryGrain) || value[0] !== queryGrain) return false;
  return value.slice(1).every(
    (grain, index) => nextLakeGrain(value[index]) === grain,
  );
}

function overlaps(a: DashboardPosition, b: DashboardPosition): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function validateAndNormalizeDashboardSpec(
  input: unknown,
): DashboardSpecParseResult {
  if (!isRecord(input)) {
    return {
      valid: false,
      findings: [
        finding(
          "invalid_dashboard",
          "dashboard",
          "Dashboard specification must be an object.",
        ),
      ],
    };
  }

  const findings: DashboardValidationFinding[] = [];
  const name = normalizeBoundedString(input.name, 256);
  const purpose = normalizeBoundedString(input.purpose, 1_000);
  const dashboardId =
    input.id === undefined ? undefined : normalizeIdentifier(input.id);
  if (input.version !== DASHBOARD_DSL_VERSION) {
    findings.push(
      finding(
        "unsupported_dsl_version",
        "dashboard.version",
        `Dashboard DSL version must be ${DASHBOARD_DSL_VERSION}.`,
      ),
    );
  }
  if (!name || !purpose || (input.id !== undefined && !dashboardId)) {
    findings.push(
      finding(
        "invalid_dashboard",
        "dashboard",
        "Dashboard id, name, and purpose must be bounded non-empty metadata.",
      ),
    );
  }

  const layout = isRecord(input.layout) ? input.layout : {};
  const columns =
    Number.isInteger(layout.columns) &&
    Number(layout.columns) > 0 &&
    Number(layout.columns) <= 24
      ? Number(layout.columns)
      : 0;
  if (
    columns === 0 ||
    (layout.density !== "compact" && layout.density !== "standard")
  ) {
    findings.push(
      finding(
        "invalid_dashboard",
        "dashboard.layout",
        "Layout requires 1–24 columns and compact or standard density.",
      ),
    );
  }

  if (!Array.isArray(input.widgets)) {
    findings.push(
      finding(
        "invalid_dashboard",
        "dashboard.widgets",
        "Dashboard widgets must be an array.",
      ),
    );
  }
  const widgets = Array.isArray(input.widgets) ? input.widgets : [];
  const normalizedWidgets: DashboardWidgetSpec[] = [];
  const positioned: Array<{ index: number; id: string; position: DashboardPosition }> = [];
  const widgetIds = new Set<string>();
  const largestPointLimit = Math.max(
    ...DASHBOARD_PRIMITIVES_V1.map((primitive) => primitive.maxPoints),
  );

  widgets.forEach((rawWidget, index) => {
    const path = `dashboard.widgets[${index}]`;
    const widget = isRecord(rawWidget) ? rawWidget : {};
    const query = isRecord(widget.query) ? widget.query : {};
    const primitive = isPrimitiveId(widget.primitive)
      ? DASHBOARD_PRIMITIVES_V1.find(
          (candidate) => candidate.id === widget.primitive,
        )
      : undefined;
    const widgetId = normalizeIdentifier(widget.id);
    const title = normalizeBoundedString(widget.title, 256);
    const widgetPurpose = normalizeBoundedString(widget.purpose, 1_000);
    const rationale = normalizeBoundedString(widget.whyThisVisualization, 2_000);

    if (!widgetId) {
      findings.push(
        finding(
          "invalid_widget_id",
          `${path}.id`,
          "Widget id must be a bounded non-empty identifier.",
        ),
      );
    } else if (widgetIds.has(widgetId)) {
      findings.push(
        finding(
          "duplicate_widget_id",
          `${path}.id`,
          `Widget id ${widgetId} must be unique.`,
        ),
      );
    } else {
      widgetIds.add(widgetId);
    }
    if (!primitive) {
      findings.push(
        finding(
          "unsupported_primitive",
          `${path}.primitive`,
          `Primitive ${String(widget.primitive)} is not in catalog version 1.`,
        ),
      );
    }
    if (
      ["sql", "jsx", "component", "render"].some(
        (field) => field in widget || field in query,
      )
    ) {
      findings.push(
        finding(
          "arbitrary_code_not_allowed",
          path,
          "Widgets may reference governed primitives and LakeQuery values only.",
        ),
      );
    }
    if (widget.rendererVersion !== DASHBOARD_RENDERER_VERSION) {
      findings.push(
        finding(
          "unsupported_renderer_version",
          `${path}.rendererVersion`,
          `Renderer version must be ${DASHBOARD_RENDERER_VERSION}.`,
        ),
      );
    }
    if (!title) {
      findings.push(
        finding(
          "missing_accessible_title",
          `${path}.title`,
          "An accessible bounded widget title is required.",
        ),
      );
    }
    if (!widgetPurpose) {
      findings.push(
        finding(
          "missing_accessible_purpose",
          `${path}.purpose`,
          "An accessible bounded widget purpose is required.",
        ),
      );
    }
    if (!rationale) {
      findings.push(
        finding(
          "missing_visualization_rationale",
          `${path}.whyThisVisualization`,
          "A bounded visualization rationale is required.",
        ),
      );
    }

    if (
      !isDataShape(widget.dataShape) ||
      (primitive && !primitive.dataShapes.includes(widget.dataShape))
    ) {
      findings.push(
        finding(
          "incompatible_data_shape",
          `${path}.dataShape`,
          "The data shape is not supported by this primitive.",
        ),
      );
    }
    const maxPoints = primitive?.maxPoints ?? largestPointLimit;
    if (
      !Number.isInteger(widget.pointLimit) ||
      Number(widget.pointLimit) <= 0 ||
      Number(widget.pointLimit) > maxPoints
    ) {
      findings.push(
        finding(
          "excessive_points",
          `${path}.pointLimit`,
          `Point limit must be between 1 and ${maxPoints}.`,
        ),
      );
    }

    if (!isLakeMetric(query.metric)) {
      findings.push(
        finding(
          "unsupported_metric",
          `${path}.query.metric`,
          `Metric ${String(query.metric)} is not supported by the live lake.`,
        ),
      );
    }
    if (!isLakeGrain(query.grain)) {
      findings.push(
        finding(
          "unsupported_grain",
          `${path}.query.grain`,
          `Grain ${String(query.grain)} is not supported.`,
        ),
      );
    }
    const filters = normalizeLakeFilters(query.filters, `${path}.query.filters`);
    for (const issue of filters.issues) {
      findings.push(
        finding(
          issue.message.includes("unavailable")
            ? "unsupported_field"
            : "invalid_filter_value",
          issue.path,
          issue.message,
        ),
      );
    }

    const drill = isRecord(widget.drill) ? widget.drill : {};
    if (
      !hasValidDrillPath(
        drill.path,
        query.grain,
        primitive?.drillBehavior ?? "explicit_path",
      )
    ) {
      findings.push(
        finding(
          "invalid_drill_path",
          `${path}.drill.path`,
          "Drill path must follow the lake hierarchy from the query grain.",
        ),
      );
    }

    const position = positionFrom(widget.position);
    const minW = primitive?.size.minW ?? 1;
    const minH = primitive?.size.minH ?? 2;
    const maxW = primitive?.size.maxW ?? Math.max(columns, 1);
    const maxH = primitive?.size.maxH ?? 24;
    if (
      !position ||
      position.w < minW ||
      position.h < minH ||
      position.w > maxW ||
      position.h > maxH
    ) {
      findings.push(
        finding(
          "invalid_size",
          `${path}.position`,
          `Widget size must be within ${minW}x${minH} and ${maxW}x${maxH}.`,
        ),
      );
    }
    if (
      !position ||
      position.x < 0 ||
      position.y < 0 ||
      position.x + position.w > columns
    ) {
      findings.push(
        finding(
          "layout_out_of_bounds",
          `${path}.position`,
          "Widget position must remain inside the dashboard grid.",
        ),
      );
    }
    if (position) {
      positioned.push({ index, id: widgetId ?? `widget-${index}`, position });
    }

    const provenance = normalizeProvenance(widget.provenance);
    if (!isRecord(widget.provenance) || !widget.provenance.runId) {
      findings.push(
        finding(
          "missing_provenance",
          `${path}.provenance`,
          "Run provenance plus at least one event or artifact is required.",
        ),
      );
    } else if (!provenance) {
      findings.push(
        finding(
          "invalid_provenance",
          `${path}.provenance`,
          "Every provenance value must be a bounded non-empty identifier.",
        ),
      );
    }

    if (
      widgetId &&
      primitive &&
      title &&
      widgetPurpose &&
      rationale &&
      isDataShape(widget.dataShape) &&
      isLakeMetric(query.metric) &&
      isLakeGrain(query.grain) &&
      filters.value &&
      hasValidDrillPath(drill.path, query.grain, primitive.drillBehavior) &&
      position &&
      provenance
    ) {
      normalizedWidgets.push({
        id: widgetId,
        primitive: primitive.id,
        rendererVersion: DASHBOARD_RENDERER_VERSION,
        title,
        purpose: widgetPurpose,
        whyThisVisualization: rationale,
        dataShape: widget.dataShape,
        pointLimit: Number(widget.pointLimit),
        query: {
          metric: query.metric,
          grain: query.grain,
          filters: filters.value,
        },
        drill: { path: [...drill.path] },
        position: { ...position },
        provenance,
      });
    }
  });

  for (let left = 0; left < positioned.length; left += 1) {
    for (let right = left + 1; right < positioned.length; right += 1) {
      if (overlaps(positioned[left].position, positioned[right].position)) {
        findings.push(
          finding(
            "layout_overlap",
            `dashboard.widgets[${positioned[right].index}].position`,
            `Widget ${positioned[right].id} overlaps ${positioned[left].id}.`,
          ),
        );
      }
    }
  }

  if (findings.length || !name || !purpose) {
    return { valid: false, findings };
  }
  return {
    valid: true,
    findings: [],
    spec: {
      version: DASHBOARD_DSL_VERSION,
      ...(dashboardId ? { id: dashboardId } : {}),
      name,
      purpose,
      layout: {
        columns,
        density: layout.density as DashboardSpec["layout"]["density"],
      },
      widgets: normalizedWidgets,
    },
  };
}

export function validateDashboardSpec(input: unknown): DashboardValidationResult {
  const { valid, findings } = validateAndNormalizeDashboardSpec(input);
  return { valid, findings };
}
