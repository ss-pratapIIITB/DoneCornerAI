import { describe, expect, it } from "vitest";
import {
  LOAD_SAMPLE_DISPLAY,
  loadSampleAgentMessage,
} from "@/lib/trueforge/load-lake-turn";

describe("load sample pack agent message", () => {
  it("tells the model to call load_lake instead of writing an approval essay", () => {
    const message = loadSampleAgentMessage("run-abc", "org-close");
    expect(LOAD_SAMPLE_DISPLAY.toLowerCase()).not.toMatch(/request approval/);
    expect(message).toMatch(/call load_lake/i);
    expect(message).toContain("runId=run-abc");
    expect(message).not.toMatch(/request approval to load_lake/i);
  });
});
