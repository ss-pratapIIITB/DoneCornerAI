import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Close canvas agent charts", () => {
  it("does not auto-dump lastCharts onto the board", () => {
    const source = readFileSync(
      join(process.cwd(), "components/dashboard/CloseCanvas.tsx"),
      "utf8",
    );
    expect(source).not.toMatch(/lastCharts\.map/);
    expect(source).not.toContain("AgentChartBlock");
  });
});
