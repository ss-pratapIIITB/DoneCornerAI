import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { inspectArtifact } from "@/lib/artifacts/inspect";
import { describeSchema } from "@/lib/cube/schema";
import { queryCube, type CubeQuery } from "@/lib/cube/query";
import { adaptDashboardSpec } from "@/lib/dashboards/adapt";
import type { DashboardSpec } from "@/lib/dashboards/dsl";
import { listDashboardPrimitives } from "@/lib/dashboards/primitives";
import {
  ensureOrgClose,
  getDashboard,
  savePersonalDashboard,
  type Dashboard,
} from "@/lib/dashboards/store";
import { requestPublishOrg } from "@/lib/dashboards/publish";
import { validateDashboardSpec } from "@/lib/dashboards/validator";
import { loadSamplePack } from "@/lib/pack/load-sample";
import { ingestCloseUpload } from "@/lib/pack/ingest";
import { seedLake } from "@/lib/lake/seed";
import { queryLake } from "@/lib/lake/query";
import { queryWarehouseSql } from "@/lib/lake/sql";
import type { LakeGrain, LakeQuery } from "@/lib/lake/types";
import { applyMapping } from "@/lib/mapping/apply";
import { createMappingProposal } from "@/lib/mapping/proposals";
import { appendRunEvent, getRun } from "@/lib/runs/ledger";

export const TOOL_NAMES = [
  "load_sample_pack",
  "load_lake",
  "upload_close_file",
  "inspect_file",
  "profile_dataset",
  "get_mapping_proposal",
  "apply_mapping",
  "describe_schema",
  "query_cube",
  "query_lake",
  "query_sql",
  "present_chart",
  "list_dashboard_primitives",
  "validate_dashboard",
  "preview_dashboard",
  "get_dashboard",
  "save_personal_dashboard",
  "request_publish_org",
] as const;

export type ToolName = (typeof TOOL_NAMES)[number];

function appendIfRunExists(
  db: DatabaseSync,
  runId: string,
  input: Parameters<typeof appendRunEvent>[2],
): void {
  if (runId && getRun(db, runId)) appendRunEvent(db, runId, input);
}

export async function callTool(
  db: DatabaseSync,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  ensureOrgClose(db);
  switch (name as ToolName) {
    case "load_sample_pack":
      return loadSamplePack(db);
    case "load_lake":
      return seedLake();
    case "upload_close_file":
      return ingestCloseUpload(db, {
        filename: String(args.filename ?? "upload.csv"),
        bytes: String(args.bytes ?? ""),
      });
    case "inspect_file":
    case "profile_dataset": {
      const artifactId = String(args.artifactId ?? "");
      if (!artifactId) throw new Error("artifactId is required");
      const result = inspectArtifact(db, {
        artifactId,
        ownerId: String(args.userId ?? "cfo"),
      });
      appendIfRunExists(db, String(args.runId ?? ""), {
        type: "artifact.inspected",
        stage: "inspect",
        summary: `Inspected ${result.artifact.filename}`,
        details: {
          artifactId,
          rows: result.profile.rowCount,
          columns: result.profile.columns.map((column) => column.name),
        },
      });
      return result;
    }
    case "get_mapping_proposal": {
      const artifactId = String(args.artifactId ?? "");
      const runId = String(args.runId ?? "");
      if (!artifactId || !runId) {
        throw new Error("artifactId and runId are required");
      }
      const proposal = createMappingProposal(db, {
        artifactId,
        runId,
        ownerId: String(args.userId ?? "cfo"),
      });
      appendIfRunExists(db, runId, {
        type: "mapping.proposed",
        stage: "mapping",
        summary: `Proposed ${proposal.confidence}-confidence mapping`,
        details: {
          proposalId: proposal.id,
          artifactId,
          proposalHash: proposal.hash,
          mapping: proposal.mapping,
          risks: proposal.risks,
          preview: proposal.preview,
        },
      });
      return proposal;
    }
    case "apply_mapping": {
      const result = await applyMapping(db, {
        proposalId: String(args.proposalId ?? ""),
        proposalHash: String(args.proposalHash ?? ""),
        ownerId: String(args.userId ?? "cfo"),
      });
      const runId = String(args.runId ?? "");
      appendIfRunExists(db, runId, {
        type: "mapping.applied",
        stage: "mapping",
        summary: `Loaded ${result.rowsWritten} canonical fact rows`,
        details: result,
      });
      return result;
    }
    case "describe_schema":
      return describeSchema();
    case "query_cube":
      return { rows: queryCube(db, args as CubeQuery) };
    case "query_lake": {
      const q = {
        metric: String(args.metric ?? "revenue"),
        grain: String(args.grain ?? "period") as LakeGrain,
        filters: (args.filters ?? { scenario: "actual" }) as LakeQuery["filters"],
      };
      return { rows: await queryLake(q), query: q };
    }
    case "query_sql":
      return queryWarehouseSql(String(args.sql ?? ""));
    case "present_chart": {
      const query = {
        metric: String(args.metric ?? "revenue"),
        grain: String(args.grain ?? "period"),
        filters: (args.filters ?? { scenario: "actual" }) as LakeQuery["filters"],
      };
      const rows = await queryLake({
        ...query,
        grain: query.grain as LakeGrain,
      });
      return {
        title: String(args.title ?? query.metric),
        query,
        rows,
        chart: { title: String(args.title ?? query.metric), query },
      };
    }
    case "list_dashboard_primitives":
      return listDashboardPrimitives(args.version ?? 1);
    case "validate_dashboard":
      return validateDashboardSpec(args.dashboard);
    case "preview_dashboard": {
      const validation = validateDashboardSpec(args.dashboard);
      if (!validation.valid) return validation;
      return {
        ...validation,
        dashboard: adaptDashboardSpec(args.dashboard as DashboardSpec, {
          owner: "preview",
        }),
      };
    }
    case "get_dashboard": {
      const id = String(args.id ?? "org-close");
      const dashboard = getDashboard(db, id);
      if (!dashboard) throw new Error("Dashboard not found");
      return dashboard;
    }
    case "save_personal_dashboard": {
      const userId = String(args.userId ?? "").trim();
      if (!userId) throw new Error("userId is required");
      const candidate = args.dashboard;
      if (
        typeof candidate === "object" &&
        candidate !== null &&
        "version" in candidate
      ) {
        const validation = validateDashboardSpec(candidate);
        if (!validation.valid) return validation;
        const spec = candidate as DashboardSpec;
        const dashboardId =
          spec.id ?? `personal-${userId}-${randomUUID().slice(0, 8)}`;
        const existing = getDashboard(db, dashboardId);
        if (existing && existing.owner !== userId) {
          throw new Error("Dashboard is owned by another user");
        }
        const dashboard = adaptDashboardSpec(spec, {
          id: dashboardId,
          owner: userId,
          forkedFrom: existing?.forkedFrom ?? null,
        });
        return {
          ...validation,
          dashboard: savePersonalDashboard(db, userId, dashboard),
        };
      }
      const dashboard = args.dashboard as Dashboard;
      return savePersonalDashboard(db, userId, dashboard);
    }
    case "request_publish_org": {
      const userId = String(args.userId ?? "").trim();
      if (!userId) throw new Error("userId is required");
      const personalId = String(args.personalId ?? "");
      return requestPublishOrg(db, userId, personalId);
    }
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}
