import type { DatabaseSync } from "node:sqlite";
import { getArtifact } from "@/lib/artifacts/store";
import { getMappingProposal } from "@/lib/mapping/proposals";
import { getRun, listRunEvents } from "@/lib/runs/ledger";

export type MappingApproval = {
  proposalId: string;
  proposalHash: string;
  artifactSha256: string;
  runId: string;
  userId: string;
  toolCallId: string;
  status: "approved" | "denied" | "consumed";
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
};

type ApprovalRow = {
  proposal_id: string;
  proposal_hash: string;
  artifact_sha256: string;
  run_id: string;
  user_id: string;
  tool_call_id: string;
  status: MappingApproval["status"];
  expires_at: string;
  created_at: string;
  consumed_at: string | null;
};

function toApproval(row: ApprovalRow): MappingApproval {
  return {
    proposalId: row.proposal_id,
    proposalHash: row.proposal_hash,
    artifactSha256: row.artifact_sha256,
    runId: row.run_id,
    userId: row.user_id,
    toolCallId: row.tool_call_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    consumedAt: row.consumed_at,
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function argumentsFrom(value: unknown): Record<string, unknown> {
  if (typeof value !== "string") return record(value);
  try {
    return record(JSON.parse(value));
  } catch {
    return {};
  }
}

export type MappingApprovalInput = {
  runId: string;
  userId: string;
  toolCallId: string;
  allow: boolean;
};

export type MappingApprovalRequirement = {
  proposalId: string;
  proposalHash: string;
  artifactSha256: string;
  runId: string;
  userId: string;
};

export function authorizeMappingFromRunApproval(
  db: DatabaseSync,
  input: MappingApprovalInput,
): MappingApproval | null {
  const run = getRun(db, input.runId);
  if (!run || run.userId !== input.userId) {
    throw new Error("Approval request not found");
  }
  const event = [...listRunEvents(db, run.id)]
    .reverse()
    .find(
      (candidate) =>
        candidate.type === "approval.requested" &&
        String(candidate.details.toolCallId ?? "") === input.toolCallId,
    );
  if (!event) throw new Error("Approval request not found");
  if (String(event.details.name ?? "") !== "apply_mapping") return null;

  const args = argumentsFrom(event.details.arguments);
  const proposalId = String(args.proposalId ?? "");
  const proposalHash = String(args.proposalHash ?? "");
  const proposal = getMappingProposal(db, proposalId);
  if (
    !proposal ||
    proposal.runId !== run.id ||
    proposal.hash !== proposalHash
  ) {
    throw new Error("Mapping proposal changed after approval was requested");
  }
  const artifact = getArtifact(db, proposal.artifactId);
  if (
    !artifact ||
    artifact.ownerId !== input.userId ||
    artifact.sha256 !== proposal.artifactSha256
  ) {
    throw new Error("Approved artifact no longer matches the proposal");
  }

  const now = new Date();
  const approval: MappingApproval = {
    proposalId,
    proposalHash,
    artifactSha256: artifact.sha256,
    runId: run.id,
    userId: input.userId,
    toolCallId: input.toolCallId,
    status: input.allow ? "approved" : "denied",
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    createdAt: now.toISOString(),
    consumedAt: null,
  };
  db.prepare(
    `INSERT INTO mapping_approvals
      (proposal_id, proposal_hash, artifact_sha256, run_id, user_id,
       tool_call_id, status, expires_at, created_at, consumed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT (proposal_id) DO UPDATE SET
       proposal_hash = excluded.proposal_hash,
       artifact_sha256 = excluded.artifact_sha256,
       run_id = excluded.run_id,
       user_id = excluded.user_id,
       tool_call_id = excluded.tool_call_id,
       status = excluded.status,
       expires_at = excluded.expires_at,
       created_at = excluded.created_at,
       consumed_at = NULL`,
  ).run(
    approval.proposalId,
    approval.proposalHash,
    approval.artifactSha256,
    approval.runId,
    approval.userId,
    approval.toolCallId,
    approval.status,
    approval.expiresAt,
    approval.createdAt,
  );
  return approval;
}

export function requireMappingApproval(
  db: DatabaseSync,
  input: MappingApprovalRequirement,
): MappingApproval {
  const row = db
    .prepare(
      `SELECT * FROM mapping_approvals
       WHERE proposal_id = ?
         AND proposal_hash = ?
         AND artifact_sha256 = ?
         AND run_id = ?
         AND user_id = ?
         AND status = 'approved'
         AND expires_at > ?`,
    )
    .get(
      input.proposalId,
      input.proposalHash,
      input.artifactSha256,
      input.runId,
      input.userId,
      new Date().toISOString(),
    ) as ApprovalRow | undefined;
  if (!row) throw new Error("A current TrueForge approval is required");
  return toApproval(row);
}

export function consumeMappingApproval(
  db: DatabaseSync,
  proposalId: string,
): void {
  db.prepare(
    `UPDATE mapping_approvals
     SET status = 'consumed', consumed_at = ?
     WHERE proposal_id = ? AND status = 'approved'`,
  ).run(new Date().toISOString(), proposalId);
}

export function revokeMappingApproval(
  db: DatabaseSync,
  proposalId: string,
): void {
  db.prepare(
    `UPDATE mapping_approvals
     SET status = 'denied'
     WHERE proposal_id = ? AND status = 'approved'`,
  ).run(proposalId);
}
