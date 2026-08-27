import { getDb, migrate } from "@/lib/db/sqlite";
import { getRun, listRunEvents } from "@/lib/runs/ledger";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ runId: string }> },
): Promise<Response> {
  const { runId } = await params;
  const db = getDb();
  migrate(db);
  const run = getRun(db, runId);
  if (!run) {
    return Response.json({ error: "Run not found" }, { status: 404 });
  }
  const after = Number(new URL(req.url).searchParams.get("after") ?? "0");
  return Response.json({
    run,
    events: listRunEvents(
      db,
      runId,
      Number.isFinite(after) && after > 0 ? Math.floor(after) : 0,
    ),
  });
}
