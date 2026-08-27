import { describe, expect, it } from "vitest";
import { uploadEntityKey } from "@/lib/mapping/apply";

describe("uploaded entity identities", () => {
  it("does not merge distinct names with the same readable slug", () => {
    expect(uploadEntityKey("Acme Inc")).not.toBe(uploadEntityKey("Acme-Inc"));
    expect(uploadEntityKey("A B")).not.toBe(uploadEntityKey("A-B"));
    expect(uploadEntityKey("Acme Inc")).toMatch(/^acme-inc-[a-f0-9]{10}$/);
  });
});
