import type { DatabaseSync } from "node:sqlite";
import { MCP_TOOLS } from "@/mcp/catalog";
import { callTool } from "@/mcp/tools";

export type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

export type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

export async function handleMcpJsonRpc(
  db: DatabaseSync,
  message: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const id = message.id ?? null;
  const method = message.method ?? "";
  if (method.startsWith("notifications/")) return null;
  try {
    if (method === "initialize") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2025-03-26",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "donecorner", version: "0.1.0" },
        },
      };
    }
    if (method === "ping") {
      return { jsonrpc: "2.0", id, result: {} };
    }
    if (method === "tools/list") {
      return { jsonrpc: "2.0", id, result: { tools: MCP_TOOLS } };
    }
    if (method === "tools/call") {
      const name = String(message.params?.name ?? "");
      const args = (message.params?.arguments ?? {}) as Record<string, unknown>;
      const value = await callTool(db, name, args);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(value) }],
        },
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown method ${method}` },
    };
  } catch (err) {
    const text = err instanceof Error ? err.message : "Tool failed";
    if (method === "tools/call") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text }],
          isError: true,
        },
      };
    }
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: text },
    };
  }
}
