// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CloseCanvas } from "@/components/dashboard/CloseCanvas";
import type { DashboardPrimitiveId } from "@/lib/dashboards/dsl";
import type { Dashboard, Widget } from "@/lib/dashboards/widgets";

const portal = vi.hoisted(() => ({
  value: {} as {
    board: Dashboard;
    requestPublish: () => Promise<void>;
    setAgent: () => void;
    lastCharts: [];
    pinChart: () => Promise<void>;
  },
}));

vi.mock("@/components/shell/AppShell", () => ({
  usePortalMode: () => "view",
  usePortal: () => portal.value,
}));

const primitives: DashboardPrimitiveId[] = [
  "kpi",
  "variance_kpi",
  "bar",
  "stacked_bar",
  "line",
  "waterfall",
  "pnl_table",
  "exception_queue",
  "markdown_insight",
];

function widget(primitive: DashboardPrimitiveId): Widget {
  return {
    id: `widget-${primitive}`,
    type: primitive === "line" ? "line" : primitive === "pnl_table" ? "pnl_table" : "bar",
    primitive,
    rendererVersion: 1,
    title: `Generated ${primitive}`,
    purpose: `Explain ${primitive}.`,
    whyThisVisualization:
      primitive === "bar" ? "Bars compare periods." : `Use ${primitive} for this signal.`,
    dataShape: "series",
    pointLimit: 12,
    query: {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    },
    lake: {
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    },
    drillPath:
      primitive === "markdown_insight"
        ? []
        : ["period", "group", "vertical", "company", "category", "product", "account"],
    provenance: {
      runId: "run-render",
      eventIds: ["event-render"],
      artifactIds: [],
    },
    layout: { x: 0, y: 0, w: 6, h: 4 },
    note: "",
  };
}

describe("generated dashboard renderers", () => {
  beforeEach(() => {
    portal.value = {
      board: {
        id: "personal-cfo-renderers",
        name: "Generated signals",
        owner: "cfo",
        forkedFrom: null,
        widgets: primitives.map(widget),
      },
      requestPublish: async () => {},
      setAgent: () => {},
      lastCharts: [],
      pinChart: async () => {},
    };
  });

  it("dispatches every governed primitive to its own deterministic renderer", () => {
    document.body.innerHTML = renderToStaticMarkup(createElement(CloseCanvas));

    for (const primitive of primitives) {
      expect(
        document.querySelector(
          `[data-dashboard-primitive="${primitive}"][data-renderer="${primitive}"]`,
        ),
      ).not.toBeNull();
    }
    expect(document.body.textContent).toContain("Bars compare periods.");
    expect(document.body.textContent).toContain("run-render");
  });

  it("enforces primitive drill and export contracts in the rendered controls", () => {
    document.body.innerHTML = renderToStaticMarkup(createElement(CloseCanvas));

    const bar = document.querySelector(
      '[data-dashboard-primitive="bar"]',
    ) as HTMLElement;
    const markdown = document.querySelector(
      '[data-dashboard-primitive="markdown_insight"]',
    ) as HTMLElement;

    expect(bar.dataset.drillEnabled).toBe("true");
    expect(bar.dataset.exportCsv).toBe("true");
    expect(bar.dataset.exportPng).toBe("true");
    expect(bar.closest(".widget-frame")?.textContent).toContain("Export CSV");
    expect(bar.closest(".widget-frame")?.textContent).toContain("Export PNG");

    expect(markdown.dataset.drillEnabled).toBe("false");
    expect(markdown.dataset.exportCsv).toBe("false");
    expect(markdown.dataset.exportPng).toBe("false");
    expect(markdown.closest(".widget-frame")?.textContent).not.toContain(
      "Export CSV",
    );
    expect(markdown.closest(".widget-frame")?.textContent).not.toContain(
      "Export PNG",
    );
  });
});
