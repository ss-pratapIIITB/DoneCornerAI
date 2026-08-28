// @vitest-environment jsdom

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AgentRail } from "@/components/shell/AgentRail";

describe("AgentRail pending gates", () => {
  it("shows Continue and Stop when the agent asked a question", () => {
    const html = renderToStaticMarkup(
      createElement(AgentRail, {
        status: "waiting_approval",
        detail: "Need a filter?",
        pendingActions: ["ask_user_question"],
        pendingKind: "question",
        onApprove: () => undefined,
        onDeny: () => undefined,
      }),
    );
    expect(html).toContain("Continue");
    expect(html).toContain("Stop");
    expect(html).not.toContain("Approve publish");
  });

  it("disables Approve while the decision is in flight", () => {
    const html = renderToStaticMarkup(
      createElement(AgentRail, {
        status: "waiting_approval",
        detail: "load_lake requires approval",
        pendingActions: ["load_lake"],
        pendingKind: "approval",
        busy: true,
        onApprove: () => undefined,
        onDeny: () => undefined,
      }),
    );
    expect(html).toContain("Approving");
    expect(html).toMatch(/disabled/);
  });
});
