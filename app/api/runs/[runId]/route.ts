import { userFromRequest } from "@/lib/api/http";
import { getDb, migrate } from "@/lib/db/sqlite";
import { appendRunEvent, getRun, updateRun } from "@/lib/runs/ledger";

export const runtime = "nodejs";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const user = userFromRequest(req);
  const db = getDb();
  migrate(db);
  const run = getRun(db, runId);
  if (!run || run.userId !== user.id) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }
  if (
    run.status === "done" ||
    run.status === "error" ||
    run.status === "cancelled"
  ) {
    return Response.json({ error: "Run is already complete" }, { status: 409 });
  }
  const body = (await req.json().catch(() => ({}))) as { summary?: string };
  const summary = body.summary?.trim() || "Agent turn failed before completion.";
  appendRunEvent(db, runId, {
    type: "run.failed",
    stage: "error",
    summary,
    details: {},
  });
  return Response.json({
    run: updateRun(db, runId, { status: "error", currentStage: "error" }),
  });
}
