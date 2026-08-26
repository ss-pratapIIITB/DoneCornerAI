import { describe, it, expect } from "vitest";
import {
  grossMarginPct,
  mrrFromArr,
  nrr,
  grr,
  runwayMonths,
  netBurn,
  ruleOf40,
} from "@/lib/cube/metrics";

describe("metrics", () => {
  it("computes gross margin", () => {
    expect(grossMarginPct(100, 20)).toBe(80);
  });
  it("returns null margin when revenue is 0", () => {
    expect(grossMarginPct(0, 10)).toBeNull();
  });
  it("converts ARR to MRR", () => {
    expect(mrrFromArr(1200)).toBe(100);
  });
  it("computes NRR", () => {
    expect(nrr(100, 20, 5, 5)).toBe(110);
  });
  it("computes GRR", () => {
    expect(grr(100, 5, 5)).toBe(90);
  });
  it("returns null runway when not burning", () => {
    expect(runwayMonths(500, 0)).toBeNull();
  });
  it("computes net burn and runway", () => {
    expect(netBurn(10, 40)).toBe(30);
    expect(runwayMonths(300, 30)).toBe(10);
  });
  it("adds growth and margin for Rule of 40", () => {
    expect(ruleOf40(25, 10)).toBe(35);
  });
});
