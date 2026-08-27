import { jsonError, userFromRequest } from "@/lib/api/http";
import { getDb, migrate } from "@/lib/db/sqlite";
import { createRun, listRuns } from "@/lib/runs/ledger";
import type { RunKind } from "@/lib/runs/types";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const user = userFromRequest(req);
  const db = getDb();
  migrate(db);
  return Response.json({
    runs: listRuns(db, { sessionId, userId: user.id }),
  });
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as {
      sessionId?: string;
      kind?: RunKind;
    };
    if (!body.sessionId || !body.kind) {
      return Response.json(
        { error: "sessionId and kind required" },
        { status: 400 },
      );
    }
    const db = getDb();
    migrate(db);
    const run = createRun(db, {
      sessionId: body.sessionId,
      kind: body.kind,
      userId: userFromRequest(req).id,
    });
    return Response.json({ run }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
