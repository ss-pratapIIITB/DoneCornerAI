import { describe, expect, it } from "vitest";
import { coerceLakeQuery } from "@/lib/lake/coerce-query";

describe("coerceLakeQuery", () => {
  it("turns Feb vs August into two YYYY-MM period keys", () => {
    const query = coerceLakeQuery({
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual", period: ["Feb", "August"] },
    });
    expect(query.filters.period).toEqual(["2025-02", "2025-08"]);
    expect(query.grain).toBe("period");
  });

  it("reads compare aliases and month-vs-month titles when period is missing", () => {
    const fromCompare = coerceLakeQuery({
      metric: "revenue",
      grain: "period",
      compare: ["february", "aug"],
      filters: { scenario: "actual", vertical: "Cloud" },
    });
    expect(fromCompare.filters.period).toEqual(["2025-02", "2025-08"]);
    expect(fromCompare.filters.vertical).toBe("Cloud");

    const fromTitle = coerceLakeQuery({
      title: "Revenue: Cloud, Feb Vs August",
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual" },
    });
    expect(fromTitle.filters.period).toEqual(["2025-02", "2025-08"]);
  });

  it("treats Cloud as a vertical when the model sends it as company or entity", () => {
    const asCompany = coerceLakeQuery({
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual", company: "Cloud" },
    });
    expect(asCompany.filters.vertical).toBe("Cloud");
    expect(asCompany.filters.company).toBeUndefined();

    const asEntity = coerceLakeQuery({
      metric: "revenue",
      grain: "period",
      filters: { scenario: "actual", entity: "Cloud" },
    });
    expect(asEntity.filters.vertical).toBe("Cloud");
  });
});
