// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LakeLoadConfirm } from "@/components/dashboard/LakeLoadConfirm";

describe("LakeLoadConfirm", () => {
  it("asks inside the close board instead of window.confirm", () => {
    const html = renderToStaticMarkup(
      createElement(LakeLoadConfirm, {
        busy: false,
        disabled: false,
        confirming: true,
        onStart: () => undefined,
        onCancel: () => undefined,
      }),
    );
    expect(html).toContain("Replace warehouse facts");
    expect(html).toMatch(/load_lake/);
    expect(html).toContain("Start load");
    expect(html).toContain("Cancel");
  });

  it("keeps CloseCanvas free of window.confirm", () => {
    const source = readFileSync(
      join(process.cwd(), "components/dashboard/CloseCanvas.tsx"),
      "utf8",
    );
    expect(source).not.toContain("window.confirm");
    expect(source).toContain("LakeLoadConfirm");
  });
});
