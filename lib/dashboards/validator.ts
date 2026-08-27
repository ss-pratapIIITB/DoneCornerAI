import {
  DASHBOARD_DATA_SHAPES,
  DASHBOARD_DSL_VERSION,
  DASHBOARD_PRIMITIVE_IDS,
  DASHBOARD_RENDERER_VERSION,
  type DashboardPosition,
  type DashboardPrimitiveId,
} from "@/lib/dashboards/dsl";
import { DASHBOARD_PRIMITIVES_V1 } from "@/lib/dashboards/primitives";
import { LAKE_GRAINS, type LakeGrain } from "@/lib/lake/types";
import { nextLakeGrain } from "@/lib/lake/drill";

export const DASHBOARD_METRICS = [
  "revenue",
  "cogs",
  "opex",
  "sm",
  "rd",
  "ga",
  "capex_tech",
  "ap",
  "net_income",
  "cash_in",
  "cash_out",
  "gross_margin_pct",
  "net_burn",
  "runway_months",
  "arr",
  "nrr",
] as const;

export type DashboardMetric = (typeof DASHBOARD_METRICS)[number];

export type DashboardFindingCode =
  | "invalid_dashboard"
  | "unsupported_dsl_version"
  | "unsupported_primitive"
  | "unsupported_renderer_version"
  | "unsupported_metric"
  | "unsupported_grain"
  | "unsupported_field"
  | "arbitrary_code_not_allowed"
  | "incompatible_data_shape"
  | "excessive_points"
  | "missing_accessible_title"
  | "missing_accessible_purpose"
  | "invalid_drill_path"
  | "invalid_size"
  | "layout_out_of_bounds"
  | "layout_overlap"
  | "missing_provenance";

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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finding(
  code: DashboardFindingCode,
  path: string,
  message: string,
): DashboardValidationFinding {
  return { code, path, message, severity: "error" };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPrimitiveId(value: unknown): value is DashboardPrimitiveId {
  return (
    typeof value === "string" &&
    DASHBOARD_PRIMITIVE_IDS.includes(value as DashboardPrimitiveId)
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
  return {
    x: x as number,
    y: y as number,
    w: w as number,
    h: h as number,
  };
}

function hasValidDrillPath(
  path: unknown,
  queryGrain: unknown,
  drillBehavior: "none" | "explicit_path",
): boolean {
  if (!Array.isArray(path) || !path.every(isLakeGrain)) return false;
  if (drillBehavior === "none") return path.length === 0;
  if (!isLakeGrain(queryGrain) || path[0] !== queryGrain) return false;
  for (let index = 1; index < path.length; index += 1) {
    if (nextLakeGrain(path[index - 1]) !== path[index]) return false;
  }
  return true;
}

function overlaps(a: DashboardPosition, b: DashboardPosition): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function validateDashboardSpec(input: unknown): DashboardValidationResult {
  const findings: DashboardValidationFinding[] = [];
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

  if (input.version !== DASHBOARD_DSL_VERSION) {
    findings.push(
      finding(
        "unsupported_dsl_version",
        "dashboard.version",
        `Dashboard DSL version must be ${DASHBOARD_DSL_VERSION}.`,
      ),
    );
  }
  if (!isNonEmptyString(input.name) || !isNonEmptyString(input.purpose)) {
    findings.push(
      finding(
        "invalid_dashboard",
        "dashboard",
        "Dashboard name and purpose are required metadata.",
      ),
    );
  }

  const layout = isRecord(input.layout) ? input.layout : {};
  const columns =
    Number.isInteger(layout.columns) && Number(layout.columns) > 0
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
        "Layout requires positive columns and compact or standard density.",
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
  const positioned: Array<{
    index: number;
    id: string;
    position: DashboardPosition;
  }> = [];
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
          "Dashboard widgets may reference governed primitives and lake queries only.",
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

    if (!isNonEmptyString(widget.title)) {
      findings.push(
        finding(
          "missing_accessible_title",
          `${path}.title`,
          "An accessible widget title is required.",
        ),
      );
    }
    if (!isNonEmptyString(widget.purpose)) {
      findings.push(
        finding(
          "missing_accessible_purpose",
          `${path}.purpose`,
          "An accessible widget purpose is required.",
        ),
      );
    }

    const globallyKnownShape =
      typeof widget.dataShape === "string" &&
      DASHBOARD_DATA_SHAPES.includes(
        widget.dataShape as (typeof DASHBOARD_DATA_SHAPES)[number],
      );
    if (
      !globallyKnownShape ||
      (primitive &&
        !primitive.dataShapes.includes(
          widget.dataShape as (typeof primitive.dataShapes)[number],
        ))
    ) {
      findings.push(
        finding(
          "incompatible_data_shape",
          `${path}.dataShape`,
          "The widget data shape is not supported by its primitive.",
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

    if (
      typeof query.metric !== "string" ||
      !DASHBOARD_METRICS.includes(query.metric as DashboardMetric)
    ) {
      findings.push(
        finding(
          "unsupported_metric",
          `${path}.query.metric`,
          `Metric ${String(query.metric)} is not supported.`,
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
    const filters = isRecord(query.filters) ? query.filters : {};
    const supportedFilters = new Set([
      "group",
      "vertical",
      "company",
      "category",
      "product",
      "period",
      "account",
      "scenario",
    ]);
    const unavailableFilter = Object.keys(filters).find(
      (field) => !supportedFilters.has(field),
    );
    if (unavailableFilter) {
      findings.push(
        finding(
          "unsupported_field",
          `${path}.query.filters.${unavailableFilter}`,
          `Filter field ${unavailableFilter} is not available in the lake query contract.`,
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
          "Drill path must follow the supported lake hierarchy from the query grain.",
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
          "Widget position must remain inside the dashboard column grid.",
        ),
      );
    }
    if (position) {
      positioned.push({
        index,
        id: isNonEmptyString(widget.id) ? widget.id : `widget-${index}`,
        position,
      });
    }

    const provenance = isRecord(widget.provenance) ? widget.provenance : {};
    const eventIds = Array.isArray(provenance.eventIds)
      ? provenance.eventIds.filter(isNonEmptyString)
      : [];
    const artifactIds = Array.isArray(provenance.artifactIds)
      ? provenance.artifactIds.filter(isNonEmptyString)
      : [];
    if (
      !isNonEmptyString(provenance.runId) ||
      eventIds.length + artifactIds.length === 0
    ) {
      findings.push(
        finding(
          "missing_provenance",
          `${path}.provenance`,
          "Run provenance plus at least one event or artifact is required.",
        ),
      );
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

  return { valid: findings.length === 0, findings };
}
