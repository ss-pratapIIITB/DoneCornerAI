import { jsonError } from "@/lib/api/http";
import type { RunKind } from "@/lib/runs/types";
import { probeTrueForge, runUserTurn } from "@/lib/trueforge/session";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const health = await probeTrueForge();
    if (!health.ok) {
      return Response.json(health, { status: 503 });
    }
    const body = (await req.json()) as {
      sessionId?: string;
      message?: string;
      runId?: string;
      kind?: RunKind;
      displayMessage?: string;
    };
    if (!body.sessionId || !body.message?.trim()) {
      return Response.json({ error: "sessionId and message required" }, { status: 400 });
    }
    const result = await runUserTurn(body.sessionId, body.message.trim(), {
      runId: body.runId,
      kind: body.kind,
      userId: "cfo",
      displayMessage: body.displayMessage,
    });
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
