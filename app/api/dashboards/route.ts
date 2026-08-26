import { getDb, migrate } from "@/lib/db/sqlite";
import {
  ensureOrgClose,
  getDashboard,
  savePersonalDashboard,
  type Dashboard,
} from "@/lib/dashboards/store";
import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";

export const runtime = "nodejs";

export async function GET(req: Request): Promise<Response> {
  const db = getDb();
  migrate(db);
  ensureOrgClose(db);
  const id = new URL(req.url).searchParams.get("id") ?? "org-close";
  const dashboard = getDashboard(db, id);
  if (!dashboard) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(dashboard);
}

export async function PUT(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const db = getDb();
    migrate(db);
    const body = (await req.json()) as Dashboard;
    const saved = savePersonalDashboard(db, user.id, body);
    return Response.json(saved);
  } catch (err) {
    return jsonError(err);
  }
}
