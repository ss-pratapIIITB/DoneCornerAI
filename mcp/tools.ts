import type { DatabaseSync } from "node:sqlite";
import { describeSchema } from "@/lib/cube/schema";
import { queryCube, type CubeQuery } from "@/lib/cube/query";
import {
  ensureOrgClose,
  getDashboard,
  savePersonalDashboard,
  type Dashboard,
} from "@/lib/dashboards/store";
import { requestPublishOrg } from "@/lib/dashboards/publish";
import { loadSamplePack } from "@/lib/pack/load-sample";
import { uploadCloseFile } from "@/lib/pack/parse-upload";
import { runSandboxClean } from "@/lib/pack/sandbox-clean";

export const TOOL_NAMES = [
  "load_sample_pack",
  "upload_close_file",
  "describe_schema",
  "query_cube",
  "get_dashboard",
  "save_personal_dashboard",
  "request_publish_org",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

export async function callTool(
  db: DatabaseSync,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  ensureOrgClose(db);
  switch (name as ToolName) {
    case "load_sample_pack":
      return loadSamplePack(db);
    case "upload_close_file": {
      const stored = uploadCloseFile({
        filename: String(args.filename ?? "upload.csv"),
        bytes: String(args.bytes ?? ""),
      });
      const cleaned = await runSandboxClean(db, stored.storedPath);
      return { ...stored, ...cleaned };
    }
    case "describe_schema":
      return describeSchema();
    case "query_cube":
      return { rows: queryCube(db, args as CubeQuery) };
    case "get_dashboard": {
      const id = String(args.id ?? "org-close");
      const dashboard = getDashboard(db, id);
      if (!dashboard) throw new Error("Dashboard not found");
      return dashboard;
    }
    case "save_personal_dashboard": {
      const userId = String(args.userId ?? "cfo");
      const dashboard = args.dashboard as Dashboard;
      return savePersonalDashboard(db, userId, dashboard);
    }
    case "request_publish_org": {
      const userId = String(args.userId ?? "cfo");
      const personalId = String(args.personalId ?? "");
      return requestPublishOrg(db, userId, personalId);
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
