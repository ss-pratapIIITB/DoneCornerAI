import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const pg = vi.hoisted(() => ({
  factId: 0,
  queries: [] as { sql: string; params?: unknown[] }[],
}));

vi.mock("@/lib/pg/migrate", () => ({
  migrateWarehouse: vi.fn(async () => undefined),
}));

vi.mock("@/lib/pg/pool", () => ({
  getPool: () => ({
    connect: async () => ({
      query: async (sql: string, params?: unknown[]) => {
        pg.queries.push({ sql, params });
        if (sql.includes("SELECT rows_written")) return { rows: [], fields: [] };
        if (sql.includes("SELECT id FROM entities")) return { rows: [], fields: [] };
        if (sql.includes("INSERT INTO facts")) {
          pg.factId += 1;
          return { rows: [{ id: pg.factId }], fields: [] };
        }
        return { rows: [], fields: [] };
      },
      release: () => undefined,
    }),
  }),
}));

import { createArtifact, getArtifact } from "@/lib/artifacts/store";
import { getDb, migrate } from "@/lib/db/sqlite";
import { applyMapping } from "@/lib/mapping/apply";
import { authorizeMappingFromRunApproval } from "@/lib/mapping/approvals";
import {
  createMappingProposal,
  getMappingProposal,
} from "@/lib/mapping/proposals";
import { appendRunEvent, createRun } from "@/lib/runs/ledger";

describe("applyMapping", () => {
  it("writes accepted facts only after consuming a bound approval", async () => {
    const root = mkdtempSync(join(tmpdir(), "dc-apply-"));
    process.env.DONECORNER_DB = join(root, "test.sqlite");
    process.env.DONECORNER_UPLOADS = join(root, "quarantine");
    const db = getDb();
    migrate(db);
    const run = createRun(db, {
      sessionId: "session-apply",
      userId: "cfo",
      kind: "file_ingest",
    });
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "finance.csv",
      mediaType: "text/csv",
      bytes: Buffer.from(
        "period,entity,account,amount\n2026-01,Acme,revenue,42",
      ),
    });
    const proposal = createMappingProposal(db, {
      artifactId: artifact.id,
      runId: run.id,
      ownerId: "cfo",
    });
    appendRunEvent(db, run.id, {
      type: "approval.requested",
      stage: "approval",
      summary: "Approval required for apply_mapping",
      details: {
        name: "apply_mapping",
        toolCallId: "call-apply",
        arguments: {
          proposalId: proposal.id,
          proposalHash: proposal.hash,
        },
      },
    });
    authorizeMappingFromRunApproval(db, {
      runId: run.id,
      userId: "cfo",
      toolCallId: "call-apply",
      allow: true,
    });

    const result = await applyMapping(db, {
      proposalId: proposal.id,
      proposalHash: proposal.hash,
      ownerId: "cfo",
    });

    expect(result).toMatchObject({ rowsWritten: 1, rowsRejected: 0 });
    expect(getMappingProposal(db, proposal.id)?.status).toBe("applied");
    expect(getArtifact(db, artifact.id)?.status).toBe("loaded");
    expect(
      pg.queries.find((query) =>
        query.sql.includes("INSERT INTO mapping_applications"),
      )?.params,
    ).toContain("call-apply");
  });
});
