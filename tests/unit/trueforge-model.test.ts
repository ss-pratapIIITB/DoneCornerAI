import { afterEach, describe, expect, it } from "vitest";
import {
  CLOSE_PACK_INSTRUCTIONS,
  SAFETY_POLICY,
  TOOL_POLICY,
  closePackModel,
  closePackSpec,
} from "@/lib/trueforge/agent";
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

  it("gates irreversible lake replace and org publish on TrueForge approval", () => {
    expect(
      closePackSpec("openai/gpt-5-4-mini").mcpServers?.[0]?.requireApprovalForTools,
    ).toEqual(["apply_mapping", "load_lake", "request_publish_org"]);
  });

  it("disables TrueForge ask_user_question so the agent queries the lake instead of interviewing the CFO", () => {
    expect(closePackSpec("openai/gpt-5-4-mini").config?.askUserQuestions).toEqual({
      enabled: false,
    });
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(/never call ask_user_question/i);
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(
      /do not write that you need approval/i,
    );
  });

  it("does not require TrueForge skills that may be unconfigured", () => {
    expect(closePackSpec("openai/gpt-5-4-mini").skills ?? []).toEqual([]);
  });

  it("puts immutable safety and tool policy on the agent spec, not only in user turns", () => {
    const instructions = closePackSpec("openai/gpt-5-4-mini").instructions ?? "";
    expect(instructions).toContain(SAFETY_POLICY);
    expect(instructions).toContain(TOOL_POLICY);
    expect(instructions).toContain(CLOSE_PACK_INSTRUCTIONS);
  });

  it("locks successful dashboard generation to validate, preview, then personal save", () => {
    const validate = CLOSE_PACK_INSTRUCTIONS.indexOf("validate_dashboard");
    const preview = CLOSE_PACK_INSTRUCTIONS.indexOf("preview_dashboard");
    const save = CLOSE_PACK_INSTRUCTIONS.indexOf("save_personal_dashboard");
    const publish = CLOSE_PACK_INSTRUCTIONS.indexOf("request_publish_org");

    expect(validate).toBeGreaterThan(-1);
    expect(preview).toBeGreaterThan(validate);
    expect(save).toBeGreaterThan(preview);
    expect(publish).toBeGreaterThan(save);
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(
      /automatically save the successful preview as the requesting user's personal draft/i,
    );
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(
      /organization publish remains separate and approval-gated/i,
    );
  });

  it("tells the model to present month comparisons as one filtered chart", () => {
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(/present_chart/);
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(/filters\.period/i);
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(/vertical/i);
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(
      /do not chart every period and then extract two months/i,
    );
  });

  it("sends the model to public-web MCP for real-company comparables", () => {
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(/lookup_public_company/);
    expect(CLOSE_PACK_INSTRUCTIONS).toMatch(/do not write public-web facts into the lake/i);
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

  it("uses the live portal origin when Next bound a different port than PORT", () => {
    delete process.env.DONECORNER_MCP_URL;
    delete process.env.PORT;
    expect(donecornerMcpUrl("http://127.0.0.1:3001/api/session")).toBe(
      "http://127.0.0.1:3001/api/mcp",
    );
    expect(donecornerMcpUrl("http://localhost:3001/")).toBe(
      "http://127.0.0.1:3001/api/mcp",
    );
  });
});
