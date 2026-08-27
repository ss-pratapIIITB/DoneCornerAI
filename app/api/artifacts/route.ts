import {
  createArtifact,
  discardQuarantinedArtifact,
} from "@/lib/artifacts/store";
import { jsonError, userFromRequest } from "@/lib/api/http";
import { getDb, migrate } from "@/lib/db/sqlite";
import { ForbiddenError } from "@/lib/identity/errors";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "CSV file required" }, { status: 400 });
    }
    const db = getDb();
    migrate(db);
    const artifact = createArtifact(db, {
      ownerId: user.id,
      filename: file.name,
      mediaType: file.type || "text/csv",
      bytes: Buffer.from(await file.arrayBuffer()),
    });
    return Response.json({ artifact }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const body = (await req.json()) as { artifactId?: string };
    if (!body.artifactId) {
      return Response.json({ error: "artifactId required" }, { status: 400 });
    }
    const db = getDb();
    migrate(db);
    discardQuarantinedArtifact(db, body.artifactId, user.id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return jsonError(error);
  }
}
