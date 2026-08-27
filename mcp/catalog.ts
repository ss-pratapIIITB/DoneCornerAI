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
    name: "load_lake",
    description:
      "Replace the Postgres lake with the Northstar Group pack (TRUNCATE facts). Requires TrueForge approval.",
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
    name: "inspect_file",
    description:
      "Inspect a quarantined CSV by opaque artifact handle. Returns schema, missingness, examples, and a sandbox validation task. Does not write lake facts.",
    inputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" },
        runId: { type: "string" },
        userId: { type: "string" },
      },
      required: ["artifactId", "runId", "userId"],
    },
  },
  {
    name: "profile_dataset",
    description:
      "Profile a quarantined CSV by opaque artifact handle. Alias of inspect_file for analysis workflows.",
    inputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" },
        runId: { type: "string" },
        userId: { type: "string" },
      },
      required: ["artifactId", "runId", "userId"],
    },
  },
  {
    name: "get_mapping_proposal",
    description:
      "Propose source-to-lake field mappings and return an immutable proposal hash. Review this result before requesting apply_mapping.",
    inputSchema: {
      type: "object",
      properties: {
        artifactId: { type: "string" },
        runId: { type: "string" },
        userId: { type: "string" },
      },
      required: ["artifactId", "runId", "userId"],
    },
  },
  {
    name: "apply_mapping",
    description:
      "Write approved rows to the canonical Postgres lake with lineage. The proposal hash must exactly match; human approval is required by TrueForge.",
    inputSchema: {
      type: "object",
      properties: {
        proposalId: { type: "string" },
        proposalHash: { type: "string" },
        runId: { type: "string" },
        userId: { type: "string" },
      },
      required: ["proposalId", "proposalHash", "runId", "userId"],
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
    name: "query_lake",
    description:
      "Query the warehouse at group/vertical/company/category/product/period/account grain.",
    inputSchema: {
      type: "object",
      properties: {
        metric: { type: "string" },
        grain: {
          type: "string",
          enum: ["group", "vertical", "company", "category", "product", "period", "account"],
        },
        filters: { type: "object" },
      },
      required: ["metric", "grain"],
    },
  },
  {
    name: "query_sql",
    description: "Read-only SELECT against Postgres (facts, entities, lake_objects).",
    inputSchema: {
      type: "object",
      properties: { sql: { type: "string" } },
      required: ["sql"],
    },
  },
  {
    name: "present_chart",
    description: "Return a chart spec and rows for the portal to render and pin.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        metric: { type: "string" },
        grain: { type: "string" },
        filters: { type: "object" },
      },
      required: ["metric", "grain"],
    },
  },
  {
    name: "list_dashboard_primitives",
    description:
      "List the governed dashboard primitive catalog, including data, layout, export, accessibility, drill, and renderer contracts.",
    inputSchema: {
      type: "object",
      properties: { version: { type: "number", enum: [1] } },
    },
  },
  {
    name: "validate_dashboard",
    description:
      "Validate a versioned dashboard DSL specification and return structured findings. Does not execute queries or save.",
    inputSchema: {
      type: "object",
      properties: { dashboard: { type: "object" } },
      required: ["dashboard"],
    },
  },
  {
    name: "preview_dashboard",
    description:
      "Validate and adapt a dashboard DSL specification for the existing live widget renderer without saving.",
    inputSchema: {
      type: "object",
      properties: { dashboard: { type: "object" } },
      required: ["dashboard"],
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
    description:
      "Validate, adapt, and save a versioned dashboard specification as the requesting user's personal draft. Does not overwrite org Close.",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" },
        dashboard: {
          type: "object",
          properties: {
            version: { type: "number", enum: [1] },
            name: { type: "string" },
            purpose: { type: "string" },
            layout: { type: "object" },
            widgets: { type: "array" },
          },
          required: ["version", "name", "purpose", "layout", "widgets"],
        },
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
