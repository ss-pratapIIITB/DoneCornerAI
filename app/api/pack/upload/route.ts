import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";
import { getDb, migrate } from "@/lib/db/sqlite";
import { ingestCloseUpload } from "@/lib/pack/ingest";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const body = (await req.json()) as { filename?: string; bytes?: string };
    if (!body.filename || !body.bytes) {
      return Response.json({ error: "filename and bytes required" }, { status: 400 });
    }
    const db = getDb();
    migrate(db);
    const result = await ingestCloseUpload(db, {
      filename: body.filename,
      bytes: body.bytes,
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
