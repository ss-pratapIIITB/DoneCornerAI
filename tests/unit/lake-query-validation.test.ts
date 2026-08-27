import { describe, expect, it } from "vitest";
import { parseLakeGrain } from "@/lib/lake/types";

describe("lake query validation", () => {
  it("accepts catalog grains and rejects SQL-shaped input", () => {
    expect(parseLakeGrain("company")).toBe("company");
    expect(() =>
      parseLakeGrain('company".name; DROP TABLE facts; --'),
    ).toThrow(/grain/i);
  });
});
