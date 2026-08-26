import { getDb, migrate } from "@/lib/db/sqlite";
import { requestPublishOrg, resolvePublish } from "@/lib/dashboards/publish";
import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    const db = getDb();
    migrate(db);
    const body = (await req.json()) as {
      action: "request" | "resolve";
      id?: string;
      personalId?: string;
      decision?: "approved" | "denied";
    };
    if (body.action === "request") {
      if (!user.canPublish) throw new ForbiddenError();
      if (!body.personalId) {
        return Response.json({ error: "personalId required" }, { status: 400 });
      }
      return Response.json(requestPublishOrg(db, user.id, body.personalId));
    }
    if (body.action === "resolve") {
      if (!user.canPublish) throw new ForbiddenError();
      if (!body.id || !body.decision) {
        return Response.json({ error: "id and decision required" }, { status: 400 });
      }
      return Response.json(
        resolvePublish(db, body.id, body.decision, user.id),
      );
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return jsonError(err);
  }
}
