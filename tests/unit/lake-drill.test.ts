import { describe, expect, it } from "vitest";
import {
  drillLake,
  drillLakeUp,
  drillPnlCell,
  nextLakeGrain,
  prevLakeGrain,
} from "@/lib/lake/drill";
import type { LakeQuery } from "@/lib/lake/types";

const base: LakeQuery = {
  metric: "revenue",
  grain: "period",
  filters: { scenario: "actual" },
};

describe("lake drill path", () => {
  it("walks period → group → vertical → company → category → product → account", () => {
    expect(nextLakeGrain("period")).toBe("group");
    expect(nextLakeGrain("group")).toBe("vertical");
    expect(nextLakeGrain("vertical")).toBe("company");
    expect(nextLakeGrain("company")).toBe("category");
    expect(nextLakeGrain("category")).toBe("product");
    expect(nextLakeGrain("product")).toBe("account");
    expect(nextLakeGrain("account")).toBeNull();
  });

  it("drills a period into the group grain with a period filter", () => {
    const next = drillLake(base, "2025-03");
    expect(next.grain).toBe("group");
    expect(next.filters.period).toEqual(["2025-03"]);
  });

  it("drills up from group back to period", () => {
    const down = drillLake(base, "2025-03");
    const up = drillLakeUp(down);
    expect(up.grain).toBe("period");
    expect(up.filters.period).toBeUndefined();
    expect(prevLakeGrain("group")).toBe("period");
  });

  it("removes the selected ancestor when drilling up", () => {
    const group = drillLake(base, "2025-03");
    const vertical = drillLake(group, "Northstar Group");
    const up = drillLakeUp(vertical);
    expect(up.grain).toBe("group");
    expect(up.filters.group).toBeUndefined();
    expect(up.filters.period).toEqual(["2025-03"]);
  });

  it("drills a P&L cell into that period and account at group grain", () => {
    const next = drillPnlCell(base, "2025-04", "sm");
    expect(next.metric).toBe("sm");
    expect(next.grain).toBe("group");
    expect(next.filters.period).toEqual(["2025-04"]);
    expect(next.filters.account).toEqual(["sm"]);
  });
});
