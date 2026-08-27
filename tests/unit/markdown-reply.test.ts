import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownReply } from "@/components/shell/MarkdownReply";

describe("MarkdownReply", () => {
  it("renders finance Markdown without executable HTML", () => {
    const html = renderToStaticMarkup(
      createElement(
        MarkdownReply,
        null,
        "## Revenue\n\n- Up 8%\n- [Evidence](https://example.com)\n\n<img src=x onerror=alert(1)>",
      ),
    );
    expect(html).toContain("<h2>Revenue</h2>");
    expect(html).toContain("<li>Up 8%</li>");
    expect(html).toContain('rel="noreferrer"');
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("<img");
  });
});
