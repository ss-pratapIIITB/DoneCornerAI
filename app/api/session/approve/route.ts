import { jsonError } from "@/lib/api/http";
import { probeTrueForge, runApprovalTurn } from "@/lib/trueforge/session";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const health = await probeTrueForge();
    if (!health.ok) {
      return Response.json(health, { status: 503 });
    }
    const body = (await req.json()) as {
      sessionId?: string;
      approvals?: {
        threadId: string;
        toolCallId: string;
        allow: boolean;
        reason?: string;
      }[];
      runId?: string;
    };
    if (!body.sessionId || !body.approvals?.length) {
      return Response.json(
        { error: "sessionId and approvals required" },
        { status: 400 },
      );
    }
    const result = await runApprovalTurn(
      body.sessionId,
      body.approvals,
      body.runId,
    );
    return Response.json(result);
  } catch (err) {
    return jsonError(err);
  }
}
