import type { DashboardSpec } from "@/lib/dashboards/dsl";
import { DASHBOARD_PRIMITIVES_V1 } from "@/lib/dashboards/primitives";
import type {
  DashboardValidationFinding,
  DashboardValidationResult,
} from "@/lib/dashboards/validator";
import type { LakeQuery, LakeRow } from "@/lib/lake/types";

export type DashboardQueryRunner = (query: LakeQuery) => Promise<unknown>;

export type DashboardRuntimeValidationResult = DashboardValidationResult & {
  rowsByWidget: Record<string, LakeRow[]>;
};

function finding(
  code:
    | "query_execution_failed"
    | "actual_data_shape_mismatch"
    | "actual_point_limit_exceeded",
  path: string,
  message: string,
): DashboardValidationFinding {
  return { code, path, message, severity: "error" };
}

function isLakeRow(value: unknown): value is LakeRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const row = value as Record<string, unknown>;
  return (
    typeof row.key === "string" &&
    row.key.trim().length > 0 &&
    row.key.length <= 256 &&
    typeof row.label === "string" &&
    row.label.trim().length > 0 &&
    row.label.length <= 256 &&
    typeof row.value === "number" &&
    Number.isFinite(row.value)
  );
}

function matchesShape(
  shape: DashboardSpec["widgets"][number]["dataShape"],
  rows: LakeRow[],
): boolean {
  switch (shape) {
    case "scalar":
    case "markdown":
      return rows.length === 1;
    case "variance":
      return rows.length === 2;
    case "grouped_series":
    case "bridge":
      return rows.length >= 2;
    case "series":
    case "table":
    case "records":
      return rows.length >= 1;
  }
}

export async function validateDashboardRuntime(
  spec: DashboardSpec,
  runQuery: DashboardQueryRunner,
): Promise<DashboardRuntimeValidationResult> {
  const findings: DashboardValidationFinding[] = [];
  const rowsByWidget: Record<string, LakeRow[]> = {};

  await Promise.all(
    spec.widgets.map(async (widget, index) => {
      const path = `dashboard.widgets[${index}]`;
      let rawRows: unknown;
      try {
        rawRows = await runQuery(widget.query);
      } catch {
        findings.push(
          finding(
            "query_execution_failed",
            `${path}.query`,
            "The live lake query could not be executed.",
          ),
        );
        return;
      }
      if (!Array.isArray(rawRows) || !rawRows.every(isLakeRow)) {
        findings.push(
          finding(
            "actual_data_shape_mismatch",
            `${path}.query`,
            "The live query returned malformed rows.",
          ),
        );
        return;
      }

      const primitive = DASHBOARD_PRIMITIVES_V1.find(
        (candidate) => candidate.id === widget.primitive,
      );
      const maximum = Math.min(
        widget.pointLimit,
        primitive?.maxPoints ?? widget.pointLimit,
      );
      if (rawRows.length > maximum) {
        findings.push(
          finding(
            "actual_point_limit_exceeded",
            `${path}.query`,
            `The live query returned ${rawRows.length} points; maximum is ${maximum}.`,
          ),
        );
      }
      if (!matchesShape(widget.dataShape, rawRows)) {
        findings.push(
          finding(
            "actual_data_shape_mismatch",
            `${path}.dataShape`,
            `The live query result does not satisfy ${widget.dataShape}.`,
          ),
        );
      }
      rowsByWidget[widget.id] = rawRows.map((row) => ({
        key: row.key.trim(),
        label: row.label.trim(),
        value: row.value,
      }));
    }),
  );

  return { valid: findings.length === 0, findings, rowsByWidget };
}
