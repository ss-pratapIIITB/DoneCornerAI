import { afterEach, describe, expect, it } from "vitest";
import { donecornerMcpUrl } from "@/lib/trueforge/harness";
import { trueforgeBaseUrl } from "@/lib/trueforge/client";
import { patchTrueForgeMain, probeTimeoutMs } from "@/lib/trueforge/hosted";

describe("TrueForge on Vercel", () => {
  afterEach(() => {
    delete process.env.TRUEFORGE_BASE_URL;
    delete process.env.DONECORNER_MCP_URL;
    delete process.env.DONECORNER_PUBLIC_HOST;
    delete process.env.VERCEL;
    delete process.env.VERCEL_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    delete process.env.PORT;
  });

  it("points the SDK at the production host when TRUEFORGE_BASE_URL is unset", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "donecorner-ai.vercel.app";
    expect(trueforgeBaseUrl()).toBe("https://donecorner-ai.vercel.app");
  });

  it("registers MCP on the public portal host so the harness can call tools", () => {
    process.env.VERCEL = "1";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "donecorner-ai.vercel.app";
    expect(donecornerMcpUrl("https://donecorner-ai.vercel.app/api/session")).toBe(
      "https://donecorner-ai.vercel.app/api/mcp",
    );
  });

  it("waits longer for a cold start on Vercel", () => {
    process.env.VERCEL = "1";
    expect(probeTimeoutMs()).toBeGreaterThanOrEqual(15_000);
  });

  it("stops TrueForge from binding a listen port and captures fetch instead", () => {
    const source = `
  const app = createServerApp({ logger });
  const server = serve({ fetch: app.fetch, port: configuration2.PORT, hostname: configuration2.HOST }, (info) => {
    logger.info(\`Agent server listening on http://\${configuration2.HOST}:\${String(info.port)} (docs at /api/v1/docs)\`);
  });
  server.on("error", (error) => {
    process.exit(1);
  });
`;
    const patched = patchTrueForgeMain(source);
    expect(patched).toContain("globalThis.__TRUEFORGE_FETCH = app.fetch");
    expect(patched).not.toMatch(/\bserve\(/);
  });
});
