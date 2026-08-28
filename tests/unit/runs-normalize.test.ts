import { describe, expect, it } from "vitest";
import {
  createNormalizationContext,
  normalizeTrueForgeEvent,
} from "@/lib/runs/normalize";

describe("TrueForge run event normalization", () => {
  it("expands model tool calls and resolves their later responses", () => {
    const context = createNormalizationContext();
    const started = normalizeTrueForgeEvent(
      {
        type: "model.message",
        id: "message-1",
        threadId: "main",
        content: "I will query the lake.",
        toolCalls: [
          {
            id: "call-1",
            function: {
              name: "query_lake",
              arguments: '{"metric":"revenue","grain":"period"}',
            },
            toolInfo: { type: "mcp", serverName: "donecorner", name: "query_lake" },
          },
        ],
      },
      context,
    );

    expect(started.map((event) => event.type)).toEqual([
      "message.completed",
      "tool.started",
    ]);
    expect(started[1]).toMatchObject({
      summary: "Calling query_lake",
      details: { name: "query_lake", toolCallId: "call-1" },
    });

    const completed = normalizeTrueForgeEvent(
      {
        type: "tool.response",
        toolCallId: "call-1",
        threadId: "main",
        content: '{"rows":[{"value":10}]}',
      },
      context,
    );
    expect(completed[0]).toMatchObject({
      type: "tool.completed",
      summary: "query_lake completed",
      details: { name: "query_lake", toolCallId: "call-1" },
    });
  });

  it("normalizes sandbox, subagent, and approval activity", () => {
    const context = createNormalizationContext();
    normalizeTrueForgeEvent(
      {
        type: "model.message",
        toolCalls: [
          {
            id: "call-2",
            function: { name: "apply_mapping", arguments: '{"proposalId":"p1"}' },
            toolInfo: { type: "mcp", name: "apply_mapping" },
          },
        ],
      },
      context,
    );

    expect(
      normalizeTrueForgeEvent(
        { type: "sandbox.created", sandboxId: "sandbox-1" },
        context,
      )[0]?.type,
    ).toBe("sandbox.created");
    expect(
      normalizeTrueForgeEvent(
        {
          type: "thread.created",
          threadId: "variance-thread",
          title: "Variance analyst",
          agentInfo: { type: "dynamic", name: "Variance analyst" },
        },
        context,
      )[0]?.type,
    ).toBe("subagent.started");
    expect(
      normalizeTrueForgeEvent(
        {
          type: "tool.approval_required",
          threadId: "main",
          toolCalls: [{ id: "call-2", sourceEventId: "message-2" }],
        },
        context,
      )[0],
    ).toMatchObject({
      type: "approval.requested",
      summary: "Approval required for apply_mapping",
      details: { name: "apply_mapping", toolCallId: "call-2" },
    });
  });

  it("marks terminal failures without exposing raw error objects", () => {
    const events = normalizeTrueForgeEvent(
      {
        type: "turn.done",
        state: {
          status: "error",
          output: { content: "Model provider timed out" },
        },
      },
      createNormalizationContext(),
    );
    expect(events[0]).toMatchObject({
      type: "run.failed",
      stage: "complete",
      summary: "Model provider timed out",
    });
  });

  it("ignores incomplete streamed tool-call chunks until a named call id exists", () => {
    const context = createNormalizationContext();
    const first = normalizeTrueForgeEvent(
      {
        type: "model.message.delta",
        threadId: "main",
        toolCalls: [{ id: "", function: { name: "", arguments: "{" } }],
      },
      context,
    );
    expect(first.filter((event) => event.type === "tool.started")).toEqual([]);

    const nameless = normalizeTrueForgeEvent(
      {
        type: "model.message.delta",
        threadId: "main",
        toolCalls: [{ id: "call-stream", function: { name: "", arguments: "{" } }],
      },
      context,
    );
    expect(nameless.filter((event) => event.type === "tool.started")).toEqual([]);

    const named = normalizeTrueForgeEvent(
      {
        type: "model.message.delta",
        threadId: "main",
        toolCalls: [
          {
            id: "call-stream",
            function: { name: "query_lake", arguments: "{}" },
          },
        ],
      },
      context,
    );
    expect(named).toEqual([
      expect.objectContaining({
        type: "tool.started",
        summary: "Calling query_lake",
        details: expect.objectContaining({ toolCallId: "call-stream" }),
      }),
    ]);

    const repeat = normalizeTrueForgeEvent(
      {
        type: "model.message.delta",
        threadId: "main",
        toolCalls: [
          {
            id: "call-stream",
            function: { name: "query_lake", arguments: "{}" },
          },
        ],
      },
      context,
    );
    expect(repeat.filter((event) => event.type === "tool.started")).toEqual([]);
  });

  it("marks MCP isError tool responses as failures", () => {
    const context = createNormalizationContext();
    normalizeTrueForgeEvent(
      {
        type: "model.message",
        toolCalls: [
          {
            id: "call-err",
            function: { name: "query_sql", arguments: "{}" },
          },
        ],
      },
      context,
    );
    const failed = normalizeTrueForgeEvent(
      {
        type: "tool.response",
        toolCallId: "call-err",
        content: JSON.stringify({
          content: [{ type: "text", text: "relation facts does not exist" }],
          isError: true,
        }),
      },
      context,
    );
    expect(failed[0]).toMatchObject({
      type: "tool.failed",
      summary: "query_sql failed",
      details: { name: "query_sql", toolCallId: "call-err" },
    });
  });

  it("marks object-shaped MCP error payloads as failures", () => {
    const context = createNormalizationContext();
    normalizeTrueForgeEvent(
      {
        type: "model.message",
        toolCalls: [{ id: "call-obj", function: { name: "query_sql" } }],
      },
      context,
    );
    const failed = normalizeTrueForgeEvent(
      {
        type: "tool.response",
        toolCallId: "call-obj",
        content: {
          content: [{ type: "text", text: "relation facts does not exist" }],
          isError: true,
        },
      },
      context,
    );
    expect(failed[0]?.type).toBe("tool.failed");
  });

  it("keeps tool.response_required call ids so the rail can resume the question", () => {
    const context = createNormalizationContext();
    normalizeTrueForgeEvent(
      {
        type: "model.message",
        toolCalls: [
          {
            id: "call-q",
            function: { name: "ask_user_question" },
          },
        ],
      },
      context,
    );
    expect(
      normalizeTrueForgeEvent(
        {
          type: "tool.response_required",
          threadId: "main",
          toolCalls: [{ id: "call-q", sourceEventId: "msg-1" }],
        },
        context,
      )[0],
    ).toMatchObject({
      type: "approval.requested",
      summary: "ask_user_question needs input",
      details: {
        toolCallId: "call-q",
        name: "ask_user_question",
        responseRequired: true,
      },
    });
  });
});
