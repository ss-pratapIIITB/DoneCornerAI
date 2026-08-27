import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { assertCanPublish } from "@/lib/identity/errors";
import { getDashboard, replaceOrgClose } from "@/lib/dashboards/store";

export type PublishState = "pending" | "approved" | "denied";

type PublishRow = {
  id: string;
  user_id: string;
  personal_id: string;
  state: PublishState;
};

export function requestPublishOrg(
  db: DatabaseSync,
  userId: string,
  personalId: string,
): { id: string; state: "pending" } {
  assertCanPublish(userId);
  const personal = getDashboard(db, personalId);
  if (!personal || personal.owner !== userId) {
    throw new Error("Personal dashboard not found");
  }
  const id = randomUUID();
  db.prepare(
    "INSERT INTO publishes (id, user_id, personal_id, state) VALUES (?, ?, ?, ?)",
  ).run(id, userId, personalId, "pending");
  return { id, state: "pending" };
}

export function resolvePublish(
  db: DatabaseSync,
  id: string,
  decision: "approved" | "denied",
  actorId: string,
): { state: PublishState } {
  assertCanPublish(actorId);
  const row = db
    .prepare("SELECT id, user_id, personal_id, state FROM publishes WHERE id = ?")
    .get(id) as PublishRow | undefined;
  if (!row) throw new Error("Publish request not found");
  if (row.state !== "pending") return { state: row.state };

  if (decision === "approved") {
    const personal = getDashboard(db, row.personal_id);
    if (!personal) throw new Error("Personal dashboard not found");
    replaceOrgClose(db, personal);
  }

  db.prepare("UPDATE publishes SET state = ? WHERE id = ?").run(decision, id);
  return { state: decision };
}
