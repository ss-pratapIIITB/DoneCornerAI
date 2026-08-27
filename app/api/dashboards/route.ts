import { getDb, migrate } from "@/lib/db/sqlite";
import {
  createPersonalDashboard,
  ensureOrgClose,
  forkOrgToPersonal,
  getDashboard,
  listPersonalDashboards,
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
  const user = userFromRequest(req);
  const url = new URL(req.url);
  if (url.searchParams.get("mine") === "1") {
    return Response.json(listPersonalDashboards(db, user.id));
  }
  const id = url.searchParams.get("id") ?? "org-close";
  const dashboard = getDashboard(db, id);
  if (!dashboard) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(dashboard);
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const db = getDb();
    migrate(db);
    const body = (await req.json().catch(() => ({}))) as {
      action?: string;
      name?: string;
    };
    if (body.action === "create") {
      return Response.json(
        createPersonalDashboard(db, user.id, body.name ?? "Untitled board"),
      );
    }
    return Response.json(forkOrgToPersonal(db, user.id));
  } catch (err) {
    return jsonError(err);
  }
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
