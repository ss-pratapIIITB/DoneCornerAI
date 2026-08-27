// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  WidgetFrame,
  inlineSvgCssVariables,
} from "@/components/dashboard/WidgetFrame";

describe("widget frame exports", () => {
  it("asks before exporting a PNG", () => {
    const confirm = vi.fn().mockReturnValue(false);
    window.confirm = confirm;
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(
        createElement(
          WidgetFrame,
          { title: "Revenue trend", allowPng: true },
          createElement("svg"),
        ),
      );
    });
    const button = [...container.querySelectorAll("button")].find(
      (node) => node.textContent === "Export PNG",
    );
    act(() => {
      button?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/export .*png/i),
    );
    act(() => root.unmount());
  });

  it("hides the resize handle unless editing is allowed", () => {
    document.body.innerHTML = renderToStaticMarkup(
      createElement(WidgetFrame, { title: "Locked", allowResize: false }, "ok"),
    );
    expect(document.querySelector(".resize-handle")).toBeNull();
  });

  it("limits filled widgets to vertical keyboard resize", () => {
    document.body.innerHTML = renderToStaticMarkup(
      createElement(
        WidgetFrame,
        { title: "Grid", fill: true, allowResize: true },
        "ok",
      ),
    );
    expect(
      document.querySelector(".resize-handle")?.getAttribute("aria-keyshortcuts"),
    ).toBe("ArrowUp ArrowDown");
  });

  it("inlines CSS variable paints before rasterizing SVG", () => {
    const xml = inlineSvgCssVariables(
      'stroke="var(--gold)" fill="var(--cyan)"',
      {
        getPropertyValue(name: string) {
          if (name === "--gold") return " #d4a017 ";
          if (name === "--cyan") return "#4fd1c5";
          return "";
        },
      },
    );
    expect(xml).toBe('stroke="#d4a017" fill="#4fd1c5"');
  });
});
