// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentRail } from "@/components/shell/AgentRail";
import type { RunEvent } from "@/lib/runs/types";

function event(type: RunEvent["type"], summary: string, details: Record<string, unknown>): RunEvent {
  return {
    id: `evt-${type}`,
    runId: "run-chart",
    sequence: 1,
    type,
    stage: "analysis",
    summary,
    details,
    createdAt: "2026-08-28T00:00:00.000Z",
  };
}

describe("AgentRail turn charts", () => {
  it("renders present_chart from the turn with enlarge and pin controls", () => {
    const html = renderToStaticMarkup(
      createElement(AgentRail, {
        status: "done",
        detail: "Feb vs August",
        canPin: true,
        onPinChart: async () => undefined,
        turns: [
          {
            id: "run-chart",
            q: "compare Feb vs August on revenue for Cloud",
            a: "Here are the two months.",
            events: [
              event("tool.completed", "present_chart completed", {
                name: "present_chart",
                response: {
                  title: "Revenue: Cloud, Feb Vs August",
                  query: {
                    metric: "revenue",
                    grain: "period",
                    filters: {
                      scenario: "actual",
                      vertical: "Cloud",
                      period: ["2025-02", "2025-08"],
                    },
                  },
                  rows: [
                    { key: "2025-02", label: "2025-02", value: 3576984 },
                    { key: "2025-08", label: "2025-08", value: 4202088 },
                  ],
                },
              }),
            ],
          },
        ],
      }),
    );
    expect(html).toContain("Revenue: Cloud, Feb Vs August");
    expect(html).toContain("Full screen");
    expect(html).toContain("Pin to dashboard");
    expect(html).toMatch(/data-agent-transcript/);
  });
});
