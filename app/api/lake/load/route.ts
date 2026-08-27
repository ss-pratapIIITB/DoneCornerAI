import { jsonError, userFromRequest } from "@/lib/api/http";
import { ForbiddenError } from "@/lib/identity/errors";
import { seedLake } from "@/lib/lake/seed";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    if (!userFromRequest(req).canEdit) {
      throw new ForbiddenError("Only finance editors can reset sample data.");
    }
    const result = await seedLake();
    return Response.json(result);
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
