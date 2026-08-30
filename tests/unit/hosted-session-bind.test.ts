import { describe, expect, it } from "vitest";
import { sessionBindDecision } from "@/lib/trueforge/session";

describe("hosted session bind", () => {
  it("uses the existing session when portal and TrueForge agree", () => {
    expect(
      sessionBindDecision({
        hosted: true,
        ownedLocally: true,
        trueforgePresent: true,
      }),
    ).toBe("use");
  });

  it("creates a new session after a Fluid instance hop", () => {
    expect(
      sessionBindDecision({
        hosted: true,
        ownedLocally: false,
        trueforgePresent: false,
      }),
    ).toBe("create");
  });

  it("creates when the portal row survived but TrueForge did not", () => {
    expect(
      sessionBindDecision({
        hosted: true,
        ownedLocally: true,
        trueforgePresent: false,
      }),
    ).toBe("create");
  });

  it("rejects an unknown session when not hosted", () => {
    expect(
      sessionBindDecision({
        hosted: false,
        ownedLocally: false,
        trueforgePresent: false,
      }),
    ).toBe("reject");
  });
});
