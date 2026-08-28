import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  stickToTranscriptBottom,
  transcriptScrollBehavior,
} from "@/lib/shell/transcript-scroll";

describe("stickToTranscriptBottom", () => {
  it("stays pinned when the viewport is at the latest messages", () => {
    expect(
      stickToTranscriptBottom({
        scrollHeight: 800,
        scrollTop: 740,
        clientHeight: 60,
      }),
    ).toBe(true);
  });

  it("releases when the reader has scrolled up", () => {
    expect(
      stickToTranscriptBottom({
        scrollHeight: 800,
        scrollTop: 20,
        clientHeight: 60,
      }),
    ).toBe(false);
  });

  it("scrolls the transcript inside the rail, not the whole page", () => {
    const css = readFileSync(join(process.cwd(), "app/signal-room.css"), "utf8");
    expect(css).toMatch(/\.agent-rail\s*\{[^}]*overflow:\s*hidden/s);
    expect(css).toMatch(/\.agent-transcript\s*\{[^}]*scroll-behavior:\s*smooth/s);
    expect(css).toMatch(/\.agent-transcript\s*\{[^}]*overflow:\s*auto/s);
    expect(css).toMatch(/overflow-anchor:\s*none/);
  });

  it("uses instant stick while the agent is streaming", () => {
    expect(transcriptScrollBehavior("running", false)).toBe("auto");
    expect(transcriptScrollBehavior("waiting_approval", false)).toBe("smooth");
    expect(transcriptScrollBehavior("done", true)).toBe("auto");
  });
});
