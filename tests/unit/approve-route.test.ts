import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/trueforge/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/trueforge/session")>();
  return {
    ...actual,
    probeTrueForge: async () => ({ ok: true as const }),
    runApprovalTurn: async () => {
      throw new Error("approval turn should not start");
    },
  };
});

import { POST } from "@/app/api/session/approve/route";
import { createArtifact } from "@/lib/artifacts/store";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  requireMappingApproval,
} from "@/lib/mapping/approvals";
import { createMappingProposal } from "@/lib/mapping/proposals";
import { appendRunEvent, createRun } from "@/lib/runs/ledger";

describe("approval route batch authorization", () => {
  it("revokes earlier mapping approvals when a later item fails", async () => {
    const root = mkdtempSync(join(tmpdir(), "dc-approve-batch-"));
    process.env.DONECORNER_DB = join(root, "test.sqlite");
    process.env.DONECORNER_UPLOADS = join(root, "uploads");
    const db = getDb();
    migrate(db);
    const run = createRun(db, {
      sessionId: "session-batch",
      userId: "cfo",
      kind: "file_ingest",
    });
    const artifact = createArtifact(db, {
      ownerId: "cfo",
      filename: "finance.csv",
      mediaType: "text/csv",
      bytes: Buffer.from("period,entity,account,amount\n2026-01,Acme,revenue,42"),
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
        toolCallId: "call-1",
        arguments: {
          proposalId: proposal.id,
          proposalHash: proposal.hash,
          runId: run.id,
          userId: "cfo",
        },
      },
    });

    const response = await POST(
      new Request("http://localhost/api/session/approve", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-demo-user": "cfo",
        },
        body: JSON.stringify({
          sessionId: "session-batch",
          runId: run.id,
          approvals: [
            { threadId: "t1", toolCallId: "call-1", allow: true },
            { threadId: "t1", toolCallId: "missing-call", allow: true },
          ],
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(() =>
      requireMappingApproval(db, {
        proposalId: proposal.id,
        proposalHash: proposal.hash,
        artifactSha256: proposal.artifactSha256,
        runId: run.id,
        userId: "cfo",
      }),
    ).toThrow(/approval/i);
  });
});
