import type { DatabaseSync } from "node:sqlite";

export type PortalResetResult = {
  cleared: string[];
  truncatedLake: false;
};

export function resetPortalState(
  db: DatabaseSync,
  userId: string,
): PortalResetResult {
  db.prepare("DELETE FROM lake_load_approvals WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM mapping_approvals WHERE user_id = ?").run(userId);
  db.prepare(
    "DELETE FROM mapping_proposals WHERE run_id IN (SELECT id FROM agent_runs WHERE user_id = ?)",
  ).run(userId);
  db.prepare(
    "DELETE FROM run_events WHERE run_id IN (SELECT id FROM agent_runs WHERE user_id = ?)",
  ).run(userId);
  db.prepare("DELETE FROM agent_runs WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM agent_sessions WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM file_artifacts WHERE owner_id = ?").run(userId);
  db.prepare("DELETE FROM publishes WHERE user_id = ?").run(userId);
  db.prepare("DELETE FROM prompt_versions WHERE owner_id = ?").run(userId);
  db.prepare("DELETE FROM dashboards WHERE owner = ?").run(userId);
  return {
    cleared: ["runs", "sessions", "personal_boards"],
    truncatedLake: false,
  };
}
