import { beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getDb, migrate } from "@/lib/db/sqlite";
import { getDashboard } from "@/lib/dashboards/store";
import { callTool } from "@/mcp/tools";

const queryLakeMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/lake/query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/lake/query")>()),
  queryLake: queryLakeMock,
}));

function freshDb() {
  process.env.DONECORNER_DB = join(
    mkdtempSync(join(tmpdir(), "dc-dashboard-dsl-")),
    "t.sqlite",
  );
  const db = getDb();
  migrate(db);
  return db;
}

function validSpec() {
  return {
    version: 1,
    id: "personal-cfo-agent-board",
    name: "Close signals",
    purpose: "Explain material close movements.",
    layout: { columns: 12, density: "standard" },
    widgets: [
      {
        id: "revenue-trend",
        primitive: "bar",
        rendererVersion: 1,
        title: "Revenue trend",
        purpose: "Show revenue movement by period.",
        whyThisVisualization: "Bars make period comparisons direct.",
        dataShape: "series",
        pointLimit: 12,
        query: {
          metric: "revenue",
          grain: "period",
          filters: { scenario: "actual" },
        },
        drill: {
          path: [
            "period",
            "group",
            "vertical",
            "company",
            "category",
            "product",
            "account",
          ],
        },
        position: { x: 0, y: 0, w: 6, h: 4 },
        provenance: {
          runId: "run-close-1",
          eventIds: ["event-query-1"],
          artifactIds: ["artifact-pack-1"],
        },
      },
    ],
  };
}

describe("agent-designed dashboard DSL", () => {
  beforeEach(() => {
    queryLakeMock.mockReset();
    queryLakeMock.mockResolvedValue([
      { key: "2026-01", label: "2026-01", value: 100 },
      { key: "2026-02", label: "2026-02", value: 110 },
    ]);
  });

  it("lists every governed primitive with a complete versioned contract", async () => {
    const result = (await callTool(freshDb(), "list_dashboard_primitives", {
      version: 1,
    })) as {
      version: number;
      primitives: Array<{
        id: string;
        dataShapes: string[];
        maxPoints: number;
        drillBehavior: string;
        size: { minW: number; minH: number; maxW: number; maxH: number };
        export: { csv: boolean; png: boolean };
        accessibility: { requiresTitle: boolean; requiresPurpose: boolean };
        rendererVersion: number;
      }>;
    };

    expect(result.version).toBe(1);
    expect(result.primitives.map((primitive) => primitive.id)).toEqual([
      "kpi",
      "variance_kpi",
      "bar",
      "stacked_bar",
      "line",
      "waterfall",
      "pnl_table",
      "exception_queue",
      "markdown_insight",
    ]);
    expect(
      result.primitives.every(
        (primitive) =>
          primitive.dataShapes.length > 0 &&
          primitive.maxPoints > 0 &&
          primitive.drillBehavior.length > 0 &&
          primitive.size.minW > 0 &&
          primitive.size.maxW >= primitive.size.minW &&
          typeof primitive.export.png === "boolean" &&
          primitive.accessibility.requiresTitle &&
          primitive.accessibility.requiresPurpose &&
          primitive.rendererVersion === 1,
      ),
    ).toBe(true);
    expect(
      result.primitives.find((primitive) => primitive.id === "markdown_insight")
        ?.export,
    ).toEqual({ csv: false, png: false });
  });

  it("accepts a live-query dashboard and preserves its rendering contract", async () => {
    const result = (await callTool(freshDb(), "validate_dashboard", {
      dashboard: validSpec(),
    })) as { valid: boolean; findings: unknown[] };

    expect(result).toEqual({ valid: true, findings: [] });

    const preview = (await callTool(freshDb(), "preview_dashboard", {
      dashboard: validSpec(),
    })) as {
      valid: boolean;
      findings: unknown[];
      dashboard: {
        name: string;
        widgets: Array<{
          type: string;
          title: string;
          layout: { x: number; y: number; w: number; h: number };
          lake: { metric: string; grain: string };
          drillPath: string[];
          provenance: { runId: string };
        }>;
      };
    };

    expect(preview.valid).toBe(true);
    expect(queryLakeMock).toHaveBeenCalledWith(
      expect.objectContaining({ metric: "revenue", grain: "period" }),
    );
    expect(preview.dashboard).toMatchObject({
      name: "Close signals",
      widgets: [
        {
          type: "bar",
          title: "Revenue trend",
          layout: { x: 0, y: 0, w: 6, h: 4 },
          lake: { metric: "revenue", grain: "period" },
          drillPath: [
            "period",
            "group",
            "vertical",
            "company",
            "category",
            "product",
            "account",
          ],
          provenance: { runId: "run-close-1" },
        },
      ],
    });
  });

  it("returns structured findings for every unsafe or unsupported contract", async () => {
    const invalid = validSpec();
    invalid.version = 2;
    invalid.layout.columns = 4;
    invalid.widgets = [
      {
        ...invalid.widgets[0],
        primitive: "arbitrary_jsx",
        rendererVersion: 99,
        title: "",
        purpose: "",
        dataShape: "network",
        pointLimit: 100_000,
        query: {
          metric: "secret_metric",
          grain: "day",
          filters: { scenario: "actual" },
        },
        drill: { path: ["period", "company", "group"] },
        position: { x: 3, y: 0, w: 3, h: 1 },
        provenance: { runId: "", eventIds: [], artifactIds: [] },
      },
      {
        ...invalid.widgets[0],
        id: "overlap",
        primitive: "bar",
        position: { x: 3, y: 0, w: 2, h: 2 },
      },
    ];

    const result = (await callTool(freshDb(), "validate_dashboard", {
      dashboard: invalid,
    })) as {
      valid: boolean;
      findings: Array<{ code: string; path: string; message: string }>;
    };
    const codes = new Set(result.findings.map((finding) => finding.code));

    expect(result.valid).toBe(false);
    expect(codes).toEqual(
      new Set([
        "unsupported_dsl_version",
        "unsupported_primitive",
        "unsupported_renderer_version",
        "unsupported_metric",
        "unsupported_grain",
        "incompatible_data_shape",
        "excessive_points",
        "missing_accessible_title",
        "missing_accessible_purpose",
        "invalid_drill_path",
        "invalid_size",
        "layout_out_of_bounds",
        "layout_overlap",
        "missing_provenance",
      ]),
    );
    expect(
      result.findings.every(
        (finding) => finding.path.startsWith("dashboard") && finding.message.length > 0,
      ),
    ).toBe(true);
  });

  it("validates before preview and returns findings without a dashboard", async () => {
    const dashboard = validSpec();
    dashboard.widgets[0].provenance.runId = "";

    const result = (await callTool(freshDb(), "preview_dashboard", {
      dashboard,
    })) as { valid: boolean; findings: unknown[]; dashboard?: unknown };

    expect(result.valid).toBe(false);
    expect(result.findings).not.toHaveLength(0);
    expect(result.dashboard).toBeUndefined();
    expect(queryLakeMock).not.toHaveBeenCalled();
  });

  it("rejects actual query results that exceed the point contract before preview", async () => {
    queryLakeMock.mockResolvedValue(
      Array.from({ length: 13 }, (_, index) => ({
        key: String(index),
        label: `Period ${index}`,
        value: index,
      })),
    );

    const result = (await callTool(freshDb(), "preview_dashboard", {
      dashboard: validSpec(),
    })) as {
      valid: boolean;
      findings: Array<{ code: string }>;
      dashboard?: unknown;
    };

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "actual_point_limit_exceeded" }),
      ]),
    );
    expect(result.dashboard).toBeUndefined();
  });

  it("rejects malformed actual query rows before save and preserves the draft", async () => {
    const db = freshDb();
    const initial = (await callTool(db, "save_personal_dashboard", {
      userId: "cfo",
      dashboard: validSpec(),
    })) as { dashboard: { id: string } };
    queryLakeMock.mockResolvedValue([
      { key: "2026-01", label: "2026-01", value: "not-a-number" },
    ]);
    const changed = validSpec();
    changed.name = "Must not persist";

    const result = (await callTool(db, "save_personal_dashboard", {
      userId: "cfo",
      dashboard: changed,
    })) as { valid: boolean; findings: Array<{ code: string }> };

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "actual_data_shape_mismatch" }),
      ]),
    );
    expect(getDashboard(db, initial.dashboard.id)?.name).toBe("Close signals");
  });

  it("rejects malformed metadata, unavailable fields, SQL, and JSX", async () => {
    const base = validSpec();
    const unsafe = {
      ...base,
      name: "",
      layout: { ...base.layout, density: "dense" },
      widgets: [
        {
          ...base.widgets[0],
          jsx: "<UnsafeWidget />",
          query: {
            ...base.widgets[0].query,
            sql: "SELECT * FROM secrets",
            filters: {
              ...base.widgets[0].query.filters,
              unavailable_field: "secret",
            },
          },
        },
      ],
    };

    const result = (await callTool(freshDb(), "validate_dashboard", {
      dashboard: unsafe,
    })) as { valid: boolean; findings: Array<{ code: string }> };

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_dashboard" }),
        expect.objectContaining({ code: "unsupported_field" }),
        expect.objectContaining({ code: "arbitrary_code_not_allowed" }),
      ]),
    );
  });

  it("accepts only executable lake metrics and valid filter runtime shapes", async () => {
    const unsupportedMetric = validSpec();
    unsupportedMetric.widgets[0].query.metric = "gross_margin_pct";
    const invalidFilters = validSpec();
    Object.assign(invalidFilters.widgets[0].query.filters, {
      scenario: "forecast",
      period: "2026-01",
      account: [""],
      company: ["Northstar"],
    });

    const metricResult = (await callTool(freshDb(), "validate_dashboard", {
      dashboard: unsupportedMetric,
    })) as { findings: Array<{ code: string }> };
    const filterResult = (await callTool(freshDb(), "validate_dashboard", {
      dashboard: invalidFilters,
    })) as { findings: Array<{ code: string }> };

    expect(metricResult.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_metric" }),
      ]),
    );
    expect(filterResult.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "invalid_filter_value" }),
      ]),
    );
  });

  it("requires unique widget identity, rationale, and bounded provenance identifiers", async () => {
    const base = validSpec();
    const dashboard = {
      ...base,
      widgets: [
        {
          ...base.widgets[0],
          id: " repeated ",
          whyThisVisualization: " ",
          provenance: {
            runId: " run-close-1 ",
            eventIds: ["event-query-1", { raw: "forbidden" }],
            artifactIds: ["x".repeat(129)],
          },
        },
        {
          ...base.widgets[0],
          id: "repeated",
          position: { x: 6, y: 0, w: 6, h: 4 },
        },
      ],
    };

    const result = (await callTool(freshDb(), "validate_dashboard", {
      dashboard,
    })) as { valid: boolean; findings: Array<{ code: string }> };

    expect(result.valid).toBe(false);
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "duplicate_widget_id" }),
        expect.objectContaining({ code: "missing_visualization_rationale" }),
        expect.objectContaining({ code: "invalid_provenance" }),
      ]),
    );
  });

  it("normalizes identity and provenance before preview adaptation", async () => {
    const dashboard = validSpec();
    dashboard.id = " personal-cfo-agent-board ";
    dashboard.widgets[0].id = " revenue-trend ";
    dashboard.widgets[0].provenance = {
      runId: " run-close-1 ",
      eventIds: [" event-query-1 "],
      artifactIds: [" artifact-pack-1 "],
    };

    const result = (await callTool(freshDb(), "preview_dashboard", {
      dashboard,
    })) as {
      dashboard: {
        id: string;
        widgets: Array<{
          id: string;
          provenance: {
            runId: string;
            eventIds: string[];
            artifactIds: string[];
          };
        }>;
      };
    };

    expect(result.dashboard).toMatchObject({
      id: "personal-cfo-agent-board",
      widgets: [
        {
          id: "revenue-trend",
          provenance: {
            runId: "run-close-1",
            eventIds: ["event-query-1"],
            artifactIds: ["artifact-pack-1"],
          },
        },
      ],
    });
  });

  it("saves a validated personal dashboard for only the requesting user", async () => {
    const db = freshDb();
    const result = (await callTool(db, "save_personal_dashboard", {
      userId: "cfo",
      dashboard: validSpec(),
    })) as {
      valid: boolean;
      findings: unknown[];
      dashboard: { id: string; owner: string; widgets: unknown[] };
    };

    expect(result).toMatchObject({
      valid: true,
      findings: [],
      dashboard: {
        id: "personal-cfo-agent-board",
        owner: "cfo",
      },
    });
    expect(result.dashboard.widgets).toHaveLength(1);
    expect(getDashboard(db, result.dashboard.id)?.owner).toBe("cfo");

    await expect(
      callTool(db, "save_personal_dashboard", {
        userId: "analyst",
        dashboard: validSpec(),
      }),
    ).rejects.toThrow(/owned by another user/i);
    expect(getDashboard(db, result.dashboard.id)?.owner).toBe("cfo");
  });

  it("does not replace an existing draft when validation fails", async () => {
    const db = freshDb();
    const saved = (await callTool(db, "save_personal_dashboard", {
      userId: "cfo",
      dashboard: validSpec(),
    })) as { dashboard: { id: string; name: string } };
    const invalid = validSpec();
    invalid.name = "Should not persist";
    invalid.widgets[0].query.metric = "not_a_metric";

    const rejected = (await callTool(db, "save_personal_dashboard", {
      userId: "cfo",
      dashboard: invalid,
    })) as { valid: boolean; findings: Array<{ code: string }> };

    expect(rejected.valid).toBe(false);
    expect(rejected.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsupported_metric" }),
      ]),
    );
    expect(getDashboard(db, saved.dashboard.id)?.name).toBe("Close signals");
  });
});
