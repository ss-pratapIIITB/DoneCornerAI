import type { DatabaseSync } from "node:sqlite";
import { replaceOrgClose } from "@/lib/dashboards/store";

export type PortalResetResult = {
  cleared: string[];
  truncatedLake: false;
};

export function resetPortalState(
  db: DatabaseSync,
  userId: string,
): PortalResetResult {
  db.exec(`
    DELETE FROM lake_load_approvals;
    DELETE FROM mapping_approvals;
    DELETE FROM mapping_proposals;
    DELETE FROM run_events;
    DELETE FROM agent_runs;
    DELETE FROM agent_sessions;
    DELETE FROM file_artifacts;
    DELETE FROM publishes;
    DELETE FROM prompt_versions;
  `);
  db.prepare("DELETE FROM dashboards WHERE owner = ?").run(userId);
  replaceOrgClose(db, {
    id: "org-close",
    name: "Northstar Close",
    owner: "org",
    forkedFrom: null,
    widgets: [],
  });
  return {
    cleared: ["runs", "sessions", "personal_boards", "org_close_widgets"],
    truncatedLake: false,
  };
}
