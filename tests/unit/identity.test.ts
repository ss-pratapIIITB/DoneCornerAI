import { describe, it, expect } from "vitest";
import { parseDemoUser } from "@/lib/identity/demo-users";

describe("parseDemoUser", () => {
  it("defaults to cfo", () => {
    expect(parseDemoUser(null)).toEqual({
      id: "cfo",
      canEdit: true,
      canPublish: true,
    });
  });
  it("maps fpna", () => {
    expect(parseDemoUser("fpna")).toEqual({
      id: "fpna",
      canEdit: true,
      canPublish: true,
    });
  });
  it("maps viewer as read-only", () => {
    expect(parseDemoUser("viewer")).toEqual({
      id: "viewer",
      canEdit: false,
      canPublish: false,
    });
  });
});
