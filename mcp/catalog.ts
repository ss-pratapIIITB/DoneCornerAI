import type { ToolName } from "@/mcp/tools";

export type McpToolDef = {
  name: ToolName;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
};

export const MCP_TOOLS: McpToolDef[] = [
  {
    name: "load_sample_pack",
    description: "Load the Northstar sample close pack into the cube. No sandbox required.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "upload_close_file",
    description:
      "Store a CSV close file and clean it in the sandbox. Requires TRUEFORGE_SANDBOX=1. USD only.",
    inputSchema: {
      type: "object",
      properties: {
        filename: { type: "string" },
        bytes: { type: "string", description: "Base64 file bytes" },
      },
      required: ["filename", "bytes"],
    },
  },
  {
    name: "describe_schema",
    description: "Describe cube tables, grains, and metrics.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "query_cube",
    description: "Query a cube metric at a grain with optional filters.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string" },
        grain: { type: "string", enum: ["period", "function", "account"] },
        filters: { type: "object" },
      },
      required: ["metric", "grain"],
    },
  },
  {
    name: "get_dashboard",
    description: "Fetch a dashboard by id (default org-close).",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
    },
  },
  {
    name: "save_personal_dashboard",
    description: "Write a personal dashboard. Does not overwrite org Close.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        dashboard: { type: "object" },
      },
      required: ["userId", "dashboard"],
    },
  },
  {
    name: "request_publish_org",
    description:
      "Request overwrite of the org Close dashboard. Requires human approval.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        personalId: { type: "string" },
      },
      required: ["userId", "personalId"],
    },
  },
];
