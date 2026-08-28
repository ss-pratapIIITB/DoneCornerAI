import { describe, expect, it } from "vitest";
import { unwrapGatedTool } from "@/lib/runs/gated-tool";

describe("unwrapGatedTool", () => {
  it("reads the inner MCP tool from TrueForge call_tool wrappers", () => {
    expect(
      unwrapGatedTool("call_tool", {
        mcp_server: "donecorner",
        tool_name: "load_lake",
        input: { runId: "run-1", userId: "cfo" },
      }),
    ).toEqual({
      name: "load_lake",
      arguments: { runId: "run-1", userId: "cfo" },
    });
  });

  it("unwraps JSON argument strings from streamed deltas", () => {
    expect(
      unwrapGatedTool(
        "call_tool",
        '{"mcp_server":"donecorner","tool_name":"apply_mapping","input":{"proposalId":"p1"}}',
      ),
    ).toMatchObject({
      name: "apply_mapping",
      arguments: { proposalId: "p1" },
    });
  });
});
