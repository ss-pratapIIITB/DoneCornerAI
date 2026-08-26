import { describe, it, expect } from "vitest";
import { appName } from "@/lib/identity/demo-users";

describe("scaffold", () => {
  it("exports app name", () => {
    expect(appName).toBe("DoneCornerAI");
  });
});
