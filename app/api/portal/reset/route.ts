import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";
import { getDb, migrate } from "@/lib/db/sqlite";
import { resetPortalState } from "@/lib/portal/reset";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) {
      throw new ForbiddenError("Only finance editors can reset the portal.");
    }
    const body = (await req.json().catch(() => ({}))) as { confirm?: unknown };
    if (body.confirm !== true) {
      return Response.json(
        { error: "Confirm portal reset before clearing session state." },
        { status: 400 },
      );
    }
    const db = getDb();
    migrate(db);
    return Response.json(resetPortalState(db, user.id));
  } catch (err) {
    return jsonError(err);
  }
}
