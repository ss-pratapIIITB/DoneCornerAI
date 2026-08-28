// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RunCard } from "@/components/shell/RunCard";
import type { RunEvent } from "@/lib/runs/types";

function event(
  type: RunEvent["type"],
  summary: string,
  details: Record<string, unknown>,
): RunEvent {
  return {
    id: summary,
    runId: "run-1",
    sequence: 1,
    type,
    stage: "tool",
    summary,
    details,
    createdAt: "2026-08-27T18:32:00.000Z",
  };
}

describe("RunCard", () => {
  it("collapses successful tool work into a Slack-style headline", () => {
    const html = renderToStaticMarkup(
      createElement(RunCard, {
        run: {
          id: "run-1",
          kind: "query",
          status: "done",
          currentStage: "complete",
        },
        events: [
          event("tool.started", "Calling tool", { name: "tool", toolCallId: "" }),
          event("tool.started", "Calling query_lake", {
            name: "query_lake",
            toolCallId: "a",
          }),
          event("tool.completed", "query_lake completed", {
            name: "query_lake",
            toolCallId: "a",
          }),
          event("tool.completed", "present_chart completed", {
            name: "present_chart",
            toolCallId: "b",
          }),
        ],
      }),
    );

    expect(html).toContain("Used query_lake, present_chart");
    expect(html).not.toContain("Calling tool");
    expect(html).not.toContain(" open");
  });

  it("opens failed runs so the broken tool is visible", () => {
    const html = renderToStaticMarkup(
      createElement(RunCard, {
        run: {
          id: "run-2",
          kind: "query",
          status: "done",
          currentStage: "complete",
        },
        events: [
          event("tool.failed", "query_sql failed", {
            name: "query_sql",
            toolCallId: "err",
          }),
        ],
      }),
    );

    expect(html).toContain("query_sql failed");
    expect(html).toContain("1 failed");
    expect(html).toContain(" open");
  });
});
