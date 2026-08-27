import { afterEach, describe, expect, it } from "vitest";
import { closePackModel, closePackSpec } from "@/lib/trueforge/agent";
import { donecornerMcpUrl } from "@/lib/trueforge/harness";

describe("closePackModel", () => {
  afterEach(() => {
    delete process.env.TRUEFORGE_MODEL;
    delete process.env.DONECORNER_MCP_URL;
    delete process.env.PORT;
  });

  it("defaults to the cheapest configured OpenAI model", () => {
    delete process.env.TRUEFORGE_MODEL;
    expect(closePackModel()).toBe("openai/gpt-5-4-mini");
  });

  it("honors TRUEFORGE_MODEL", () => {
    process.env.TRUEFORGE_MODEL = "openai/gpt-5-5";
    expect(closePackModel()).toBe("openai/gpt-5-5");
  });

  it("does not require TrueForge skills that may be unconfigured", () => {
    expect(closePackSpec("openai/gpt-5-4-mini").skills ?? []).toEqual([]);
  });
});

describe("donecornerMcpUrl", () => {
  afterEach(() => {
    delete process.env.DONECORNER_MCP_URL;
    delete process.env.PORT;
  });

  it("follows the portal PORT so TrueForge can reach MCP", () => {
    delete process.env.DONECORNER_MCP_URL;
    process.env.PORT = "3001";
    expect(donecornerMcpUrl()).toBe("http://127.0.0.1:3001/api/mcp");
  });
});
