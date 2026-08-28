import type { NewRunEvent } from "@/lib/runs/types";

type ToolState = {
  name: string;
  arguments: unknown;
  threadId: string;
  source: string;
};

export type NormalizationContext = {
  tools: Map<string, ToolState>;
};

export function createNormalizationContext(): NormalizationContext {
  return { tools: new Map() };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const item = value as Record<string, unknown>;
  if (item.data && typeof item.data === "object") {
    return item.data as Record<string, unknown>;
  }
  return item;
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        const part = record(item);
        return typeof part.text === "string" ? part.text : "";
      })
      .join("");
  }
  const item = record(value);
  return typeof item.content === "string"
    ? item.content
    : typeof item.text === "string"
      ? item.text
      : "";
}

function parsedJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  }
}

function stageForTool(name: string): string {
  if (/inspect|profile/.test(name)) return "inspect";
  if (/mapping|lineage/.test(name)) return "mapping";
  if (/query|chart/.test(name)) return "analysis";
  if (/dashboard|primitive/.test(name)) return "dashboard";
  if (/publish/.test(name)) return "publish";
  if (name === "exec") return "sandbox";
  return "tool";
}

function event(
  type: NewRunEvent["type"],
  stage: string,
  summary: string,
  details: Record<string, unknown> = {},
): NewRunEvent {
  return { type, stage, summary, details };
}

function toolCalls(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];
}

function toolName(call: Record<string, unknown>): string {
  const info = record(call.toolInfo ?? call.tool_info);
  const fn = record(call.function);
  return String(info.name ?? fn.name ?? call.name ?? "tool");
}

function toolArguments(call: Record<string, unknown>): unknown {
  const fn = record(call.function);
  return parsedJson(fn.arguments ?? call.arguments ?? {});
}

function responsePayload(raw: Record<string, unknown>): unknown {
  const content = raw.content ?? raw.text ?? raw.result;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content;
  }
  return parsedJson(text(content));
}

function toolResponseFailed(raw: Record<string, unknown>, payload: unknown): boolean {
  if (raw.isError === true || raw.is_error === true) return true;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const body = payload as Record<string, unknown>;
  if (body.isError === true || body.is_error === true) return true;
  return typeof body.error === "string" && body.error.trim().length > 0;
}

export function normalizeTrueForgeEvent(
  input: unknown,
  context: NormalizationContext,
): NewRunEvent[] {
  const raw = record(input);
  const type = String(raw.type ?? "");
  const threadId = String(raw.threadId ?? raw.thread_id ?? "main");

  if (type === "turn.created") {
    return [
      event("run.started", "starting", "Agent run started", {
        turnId: raw.turnId ?? raw.turn_id,
      }),
    ];
  }

  if (type === "model.message" || type === "model.message.delta") {
    const events: NewRunEvent[] = [];
    const content = text(raw.content);
    if (content) {
      events.push(
        event(
          type === "model.message.delta"
            ? "message.delta"
            : "message.completed",
          "reasoning",
          content,
          { messageId: raw.id, threadId, content },
        ),
      );
    }
    for (const call of toolCalls(raw.toolCalls ?? raw.tool_calls)) {
      const id = String(call.id ?? call.toolCallId ?? call.tool_call_id ?? "");
      const name = toolName(call);
      if (!id || !name || name === "tool") continue;
      if (context.tools.has(id)) continue;
      const info = record(call.toolInfo ?? call.tool_info);
      const state: ToolState = {
        name,
        arguments: toolArguments(call),
        threadId,
        source: String(info.type ?? info.serverName ?? info.server_name ?? "tool"),
      };
      context.tools.set(id, state);
      events.push(
        event("tool.started", stageForTool(name), `Calling ${name}`, {
          toolCallId: id,
          name,
          arguments: state.arguments,
          threadId,
          source: state.source,
        }),
      );
    }
    return events;
  }

  if (type === "tool.response" || type === "tool.result") {
    const toolCallId = String(raw.toolCallId ?? raw.tool_call_id ?? "");
    const known = context.tools.get(toolCallId);
    const name = known?.name ?? "tool";
    const payload = responsePayload(raw);
    const failed = toolResponseFailed(raw, payload);
    return [
      event(
        failed ? "tool.failed" : "tool.completed",
        stageForTool(name),
        failed ? `${name} failed` : `${name} completed`,
        {
          toolCallId,
          name,
          threadId,
          response: payload,
        },
      ),
    ];
  }

  if (type === "tool.response_required") {
    const calls = toolCalls(raw.toolCalls ?? raw.tool_calls);
    const fallbackId = String(raw.toolCallId ?? raw.tool_call_id ?? "");
    const ids = calls.length
      ? calls
      : fallbackId
        ? [{ id: fallbackId } as Record<string, unknown>]
        : [];
    return ids.map((call) => {
      const toolCallId = String(
        call.toolCallId ?? call.tool_call_id ?? call.id ?? "",
      );
      const known = context.tools.get(toolCallId);
      const name = known?.name ?? toolName(call);
      return event(
        "approval.requested",
        stageForTool(name),
        `${name} needs input`,
        {
          toolCallId,
          name,
          threadId,
          responseRequired: true,
        },
      );
    });
  }

  if (type === "tool.approval_required") {
    return toolCalls(raw.toolCalls ?? raw.tool_calls).map((call) => {
      const toolCallId = String(
        call.toolCallId ?? call.tool_call_id ?? call.id ?? "",
      );
      const known = context.tools.get(toolCallId);
      const name = known?.name ?? toolName(call);
      return event(
        "approval.requested",
        stageForTool(name),
        `Approval required for ${name}`,
        {
          toolCallId,
          name,
          arguments: known?.arguments ?? toolArguments(call),
          threadId,
          sourceEventId: call.sourceEventId ?? call.source_event_id,
        },
      );
    });
  }

  if (type === "sandbox.created") {
    return [
      event("sandbox.created", "sandbox", "Secure sandbox ready", {
        sandboxId: raw.sandboxId ?? raw.sandbox_id,
        threadId,
      }),
    ];
  }

  if (type === "thread.created") {
    const info = record(raw.agentInfo ?? raw.agent_info);
    const title = String(raw.title ?? info.name ?? "Subagent");
    return [
      event("subagent.started", "analysis", `${title} started`, {
        threadId,
        title,
        agent: info.name,
        input: info.input,
        model: info.model,
        parent: raw.parent,
      }),
    ];
  }

  if (type === "thread.done") {
    const state = record(raw.state);
    const title = String(raw.title ?? "Subagent");
    const failed = state.status === "error" || state.status === "cancelled";
    return [
      event(
        failed ? "subagent.failed" : "subagent.completed",
        "analysis",
        failed ? `${title} failed` : `${title} completed`,
        {
          threadId,
          title,
          status: state.status,
          output: text(state.output),
        },
      ),
    ];
  }

  if (type === "mcp.initialize") {
    return [
      event("mcp.connected", "starting", "MCP tools connected", {
        servers: raw.mcpServers ?? raw.mcp_servers,
      }),
    ];
  }

  if (type === "mcp.auth_required") {
    return [
      event("mcp.auth_required", "starting", "MCP authentication required", {
        servers: raw.mcpServers ?? raw.mcp_servers,
      }),
    ];
  }

  if (type === "turn.done") {
    const state = record(raw.state);
    const output = text(state.output);
    const status = String(state.status ?? "done");
    const requiredActions =
      state.requiredActions ?? state.required_actions ?? [];
    if (Array.isArray(requiredActions) && requiredActions.length > 0) {
      return [
        event(
          "run.waiting_approval",
          "approval",
          output || "Waiting for approval",
          { status, requiredActions },
        ),
      ];
    }
    if (status === "error") {
      return [
        event("run.failed", "complete", output || "Agent run failed", {
          status,
        }),
      ];
    }
    if (status === "cancelled") {
      return [
        event("run.cancelled", "complete", output || "Agent run cancelled", {
          status,
        }),
      ];
    }
    return [
      event("run.completed", "complete", output || "Agent run completed", {
        status,
      }),
    ];
  }

  return [];
}
