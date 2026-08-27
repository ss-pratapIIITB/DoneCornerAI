import type { DatabaseSync } from "node:sqlite";
import { getRun, listRunEvents } from "@/lib/runs/ledger";

export type LakeLoadApproval = {
  toolCallId: string;
  runId: string;
  userId: string;
  status: "approved" | "denied" | "consumed";
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
};

type ApprovalRow = {
  tool_call_id: string;
  run_id: string;
  user_id: string;
  status: LakeLoadApproval["status"];
  expires_at: string;
  created_at: string;
  consumed_at: string | null;
};

function toApproval(row: ApprovalRow): LakeLoadApproval {
  return {
    toolCallId: row.tool_call_id,
    runId: row.run_id,
    userId: row.user_id,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    consumedAt: row.consumed_at,
  };
}

export function authorizeLakeLoadFromRunApproval(
  db: DatabaseSync,
  input: { runId: string; userId: string; toolCallId: string; allow: boolean },
): LakeLoadApproval | null {
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
  if (String(event.details.name ?? "") !== "load_lake") return null;

  const now = new Date();
  const approval: LakeLoadApproval = {
    toolCallId: input.toolCallId,
    runId: run.id,
    userId: input.userId,
    status: input.allow ? "approved" : "denied",
    expiresAt: new Date(now.getTime() + 10 * 60_000).toISOString(),
    createdAt: now.toISOString(),
    consumedAt: null,
  };
  db.prepare(
    `INSERT INTO lake_load_approvals
      (tool_call_id, run_id, user_id, status, expires_at, created_at, consumed_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL)
     ON CONFLICT (tool_call_id) DO UPDATE SET
       run_id = excluded.run_id,
       user_id = excluded.user_id,
       status = excluded.status,
       expires_at = excluded.expires_at,
       created_at = excluded.created_at,
       consumed_at = NULL`,
  ).run(
    approval.toolCallId,
    approval.runId,
    approval.userId,
    approval.status,
    approval.expiresAt,
    approval.createdAt,
  );
  return approval;
}

export function requireLakeLoadApproval(
  db: DatabaseSync,
  input: { runId: string; userId: string },
): LakeLoadApproval {
  const row = db
    .prepare(
      `SELECT * FROM lake_load_approvals
       WHERE run_id = ?
         AND user_id = ?
         AND status = 'approved'
         AND expires_at > ?
       ORDER BY created_at DESC
       LIMIT 1`,
    )
    .get(input.runId, input.userId, new Date().toISOString()) as
    | ApprovalRow
    | undefined;
  if (!row) throw new Error("A current TrueForge load_lake approval is required");
  return toApproval(row);
}

export function consumeLakeLoadApproval(
  db: DatabaseSync,
  toolCallId: string,
): void {
  db.prepare(
    `UPDATE lake_load_approvals
     SET status = 'consumed', consumed_at = ?
     WHERE tool_call_id = ? AND status = 'approved'`,
  ).run(new Date().toISOString(), toolCallId);
}

export function revokeLakeLoadApproval(db: DatabaseSync, toolCallId: string): void {
  db.prepare(
    `UPDATE lake_load_approvals
     SET status = 'denied'
     WHERE tool_call_id = ? AND status = 'approved'`,
  ).run(toolCallId);
}
