import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createArtifact } from "@/lib/artifacts/store";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  authorizeMappingFromRunApproval,
  requireMappingApproval,
} from "@/lib/mapping/approvals";
import { createMappingProposal } from "@/lib/mapping/proposals";
import { appendRunEvent, createRun } from "@/lib/runs/ledger";

function setup() {
  const root = mkdtempSync(join(tmpdir(), "dc-approval-"));
  process.env.DONECORNER_DB = join(root, "test.sqlite");
  process.env.DONECORNER_UPLOADS = join(root, "quarantine");
  const db = getDb();
  migrate(db);
  const run = createRun(db, {
    sessionId: "session-approval",
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
  return { db, run, proposal };
}

describe("mapping execution approval", () => {
  it("rejects direct execution without an approved TrueForge tool call", () => {
    const { db, proposal } = setup();
    expect(() =>
      requireMappingApproval(db, {
        proposalId: proposal.id,
        proposalHash: proposal.hash,
        artifactSha256: proposal.artifactSha256,
        runId: proposal.runId,
        userId: "cfo",
      }),
    ).toThrow(/approval/i);
  });

  it("binds authorization to the run, user, proposal, digest, and tool call", () => {
    const { db, run, proposal } = setup();
    appendRunEvent(db, run.id, {
      type: "approval.requested",
      stage: "approval",
      summary: "Approval required for apply_mapping",
      details: {
        name: "apply_mapping",
        toolCallId: "call-1",
        arguments: {
          proposalId: proposal.id,
          proposalHash: proposal.hash,
          runId: run.id,
          userId: "cfo",
        },
      },
    });

    authorizeMappingFromRunApproval(db, {
      runId: run.id,
      userId: "cfo",
      toolCallId: "call-1",
      allow: true,
    });

    expect(
      requireMappingApproval(db, {
        proposalId: proposal.id,
        proposalHash: proposal.hash,
        artifactSha256: proposal.artifactSha256,
        runId: run.id,
        userId: "cfo",
      }),
    ).toMatchObject({ toolCallId: "call-1", status: "approved" });
    expect(() =>
      requireMappingApproval(db, {
        proposalId: proposal.id,
        proposalHash: proposal.hash,
        artifactSha256: proposal.artifactSha256,
        runId: run.id,
        userId: "fpna",
      }),
    ).toThrow(/approval/i);
  });
});
