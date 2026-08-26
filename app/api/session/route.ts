import { jsonError } from "@/lib/api/http";
import { probeTrueForge, resumeOrCreateSession } from "@/lib/trueforge/session";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const health = await probeTrueForge();
  if (!health.ok) {
    return Response.json(health, { status: 503 });
  }
  return Response.json(health);
}

export async function POST(req: Request): Promise<Response> {
  try {
    const health = await probeTrueForge();
    if (!health.ok) {
      return Response.json(health, { status: 503 });
    }
    const body = (await req.json().catch(() => ({}))) as { sessionId?: string };
    const session = await resumeOrCreateSession(body.sessionId);
    return Response.json(session);
  } catch (err) {
    return jsonError(err);
  }
}
