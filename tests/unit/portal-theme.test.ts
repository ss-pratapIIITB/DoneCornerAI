// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { PortalResetConfirm } from "@/components/shell/PortalResetConfirm";

describe("portal theme and reset controls", () => {
  it("uses butter white for light mode instead of pure white", () => {
    const css = readFileSync(join(process.cwd(), "app/signal-room.css"), "utf8");
    expect(css).toMatch(/\[data-theme=["']light["']\]/);
    expect(css).toMatch(/#f4ead8|#f6edd4|#f3ead4|#f7f0dc/i);
    expect(css).not.toMatch(/\[data-theme=["']light["']\][^{]*\{[^}]*--ink:\s*#fff(?:fff)?/i);
  });

  it("exposes light/dark and an in-page reset confirm", () => {
    const theme = renderToStaticMarkup(createElement(ThemeToggle));
    expect(theme).toMatch(/Light|Dark/);

    const reset = renderToStaticMarkup(
      createElement(PortalResetConfirm, {
        confirming: true,
        onStart: () => undefined,
        onCancel: () => undefined,
      }),
    );
    expect(reset).toMatch(/reset/i);
    expect(reset).toContain("Cancel");
  });

  it("applies theme from a cookie instead of a layout script", () => {
    const layout = readFileSync(join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).not.toMatch(/<script/i);
    expect(layout).not.toMatch(/next\/script/);
    expect(layout).toMatch(/cookies\(/);
    expect(layout).toMatch(/data-theme/);
  });
});
