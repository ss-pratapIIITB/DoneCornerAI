import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/lake/load/route";

describe("lake sample reset route", () => {
  it("does not mutate data through GET", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("rejects read-only demo users before seeding", async () => {
    const response = await POST(
      new Request("http://localhost/api/lake/load", {
        method: "POST",
        headers: { "x-demo-user": "viewer" },
      }),
    );
    expect(response.status).toBe(403);
  });
});
