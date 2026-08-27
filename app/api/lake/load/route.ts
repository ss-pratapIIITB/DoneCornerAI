import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    if (!userFromRequest(req).canEdit) {
      throw new ForbiddenError("Only finance editors can reset sample data.");
    }
    return Response.json(
      {
        error:
          "Replacing the lake requires an approved load_lake tool call. Confirm in the portal, then approve the TrueForge pause.",
      },
      { status: 403 },
    );
  } catch (err) {
    return jsonError(err);
  }
}

export async function GET(): Promise<Response> {
  return Response.json(
    { error: "Use an authorized POST to load sample data." },
    { status: 405, headers: { Allow: "POST" } },
  );
}
