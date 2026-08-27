import type { DatabaseSync } from "node:sqlite";

export function bindAgentSession(
  db: DatabaseSync,
  sessionId: string,
  userId: string,
): void {
  db.prepare(
    `INSERT INTO agent_sessions (session_id, user_id, created_at)
     VALUES (?, ?, ?)
     ON CONFLICT (session_id) DO NOTHING`,
  ).run(sessionId, userId, new Date().toISOString());
  assertAgentSessionOwner(db, sessionId, userId);
}

export function isAgentSessionOwner(
  db: DatabaseSync,
  sessionId: string,
  userId: string,
): boolean {
  const row = db
    .prepare("SELECT user_id FROM agent_sessions WHERE session_id = ?")
    .get(sessionId) as { user_id: string } | undefined;
  return row?.user_id === userId;
}

export function assertAgentSessionOwner(
  db: DatabaseSync,
  sessionId: string,
  userId: string,
): void {
  if (!isAgentSessionOwner(db, sessionId, userId)) {
    throw new Error("Agent session not found");
  }
}
