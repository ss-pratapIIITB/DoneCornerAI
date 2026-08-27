import { afterEach, describe, expect, it, vi } from "vitest";
import { probeTrueForge } from "@/lib/trueforge/session";

describe("probeTrueForge", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("is healthy when the sessions API returns 200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/sessions")) {
          return new Response(JSON.stringify({ data: [] }), { status: 200 });
        }
        return new Response("<html>ui</html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        });
      }),
    );
    await expect(probeTrueForge()).resolves.toEqual({ ok: true });
  });

  it("is down when only the HTML UI answers and the sessions API is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/v1/sessions")) {
          return new Response(JSON.stringify({ error: { message: "Route not found" } }), {
            status: 404,
          });
        }
        return new Response("<html>ui</html>", { status: 200 });
      }),
    );
    const health = await probeTrueForge();
    expect(health.ok).toBe(false);
  });
});
