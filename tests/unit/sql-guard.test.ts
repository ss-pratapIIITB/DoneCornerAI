import { describe, expect, it } from "vitest";
import { assertReadOnlySelect } from "@/lib/lake/sql-guard";

describe("assertReadOnlySelect", () => {
  it("allows a select", () => {
    expect(assertReadOnlySelect("SELECT 1")).toBe("SELECT 1");
  });

  it("rejects mutating sql", () => {
    expect(() => assertReadOnlySelect("DELETE FROM facts")).toThrow(/select/i);
  });

  it("rejects multiple statements", () => {
    expect(() => assertReadOnlySelect("SELECT 1; SELECT 2")).toThrow(/one statement/i);
  });
});
