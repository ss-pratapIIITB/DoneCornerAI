import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";
import { getDb, migrate } from "@/lib/db/sqlite";
import { uploadCloseFile } from "@/lib/pack/parse-upload";
import { runSandboxClean } from "@/lib/pack/sandbox-clean";
import { runCloseSubagents } from "@/lib/analysis/subagents";

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
    const stored = uploadCloseFile({
      filename: body.filename,
      bytes: body.bytes,
    });
    const cleaned = await runSandboxClean(db, stored.storedPath);
    const analysis =
      cleaned.rowsLoaded > 0 ? await runCloseSubagents(db) : null;
    return Response.json({ ...stored, ...cleaned, analysis });
  } catch (err) {
    return jsonError(err);
  }
}
