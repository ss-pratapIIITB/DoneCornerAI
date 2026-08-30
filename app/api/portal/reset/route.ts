import { jsonError } from "@/lib/api/http";
import { parseDemoUser } from "@/lib/identity/demo-users";
import { ForbiddenError } from "@/lib/identity/errors";
import { readSessionUserId } from "@/lib/identity/session";
import { getDb, migrate } from "@/lib/db/sqlite";
import { resetPortalState } from "@/lib/portal/reset";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const header = req.headers.get("x-demo-user");
    const sessionUser = readSessionUserId(req);
    const id = sessionUser ?? (header === "cfo" || header === "fpna" ? header : null);
    if (!id) {
      throw new ForbiddenError("Sign in as a finance editor to reset the portal.");
    }
    const user = parseDemoUser(id);
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
