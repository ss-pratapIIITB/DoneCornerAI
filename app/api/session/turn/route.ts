import { jsonError, userFromRequest } from "@/lib/api/http";
import { getDb, migrate } from "@/lib/db/sqlite";
import { appendRunEvent, getRun, updateRun } from "@/lib/runs/ledger";
import type { RunKind } from "@/lib/runs/types";
import { probeTrueForge, runUserTurn } from "@/lib/trueforge/session";

export const runtime = "nodejs";

function failOwnedRun(runId: string | undefined, userId: string, summary: string) {
  if (!runId) return;
  const db = getDb();
  migrate(db);
  const run = getRun(db, runId);
  if (
    !run ||
    run.userId !== userId ||
    run.status === "done" ||
    run.status === "error" ||
    run.status === "cancelled"
  ) return;
  appendRunEvent(db, runId, {
    type: "run.failed",
    stage: "error",
    summary,
    details: {},
  });
  updateRun(db, runId, { status: "error", currentStage: "error" });
}

export async function POST(req: Request): Promise<Response> {
  let runId: string | undefined;
  const user = userFromRequest(req);
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      message?: string;
      runId?: string;
      kind?: RunKind;
      displayMessage?: string;
    };
    runId = body.runId;
    if (!body.sessionId || !body.message?.trim()) {
      failOwnedRun(runId, user.id, "Agent turn request was invalid.");
      return Response.json({ error: "sessionId and message required" }, { status: 400 });
    }
    const health = await probeTrueForge();
    if (!health.ok) {
      failOwnedRun(runId, user.id, health.reason);
      return Response.json(health, { status: 503 });
    }
    const result = await runUserTurn(body.sessionId, body.message.trim(), {
      runId: body.runId,
      kind: body.kind,
      userId: user.id,
      displayMessage: body.displayMessage,
    });
    return Response.json(result);
  } catch (err) {
    failOwnedRun(
      runId,
      user.id,
      err instanceof Error ? err.message : "Agent turn failed to start.",
    );
    return jsonError(err);
  }
}
