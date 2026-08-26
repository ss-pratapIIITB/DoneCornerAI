import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";
import { uploadCloseFile } from "@/lib/pack/parse-upload";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const body = (await req.json()) as { filename?: string; bytes?: string };
    if (!body.filename || !body.bytes) {
      return Response.json({ error: "filename and bytes required" }, { status: 400 });
    }
    return Response.json(
      uploadCloseFile({ filename: body.filename, bytes: body.bytes }),
    );
  } catch (err) {
    return jsonError(err);
  }
}
