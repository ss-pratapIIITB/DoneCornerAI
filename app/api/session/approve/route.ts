import { jsonError, userFromRequest } from "@/lib/api/http";
import { getDb, migrate } from "@/lib/db/sqlite";
import {
  authorizeMappingFromRunApproval,
  revokeMappingApproval,
} from "@/lib/mapping/approvals";
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
    const user = userFromRequest(req);
    const authorizedProposals: string[] = [];
    if (body.runId) {
      const db = getDb();
      migrate(db);
      for (const approval of body.approvals) {
        const mapping = authorizeMappingFromRunApproval(db, {
          runId: body.runId,
          userId: user.id,
          toolCallId: approval.toolCallId,
          allow: approval.allow,
        });
        if (mapping?.status === "approved") {
          authorizedProposals.push(mapping.proposalId);
        }
      }
    }
    try {
      const result = await runApprovalTurn(
        body.sessionId,
        body.approvals,
        user.id,
        body.runId,
      );
      return Response.json(result);
    } catch (error) {
      const db = getDb();
      for (const proposalId of authorizedProposals) {
        revokeMappingApproval(db, proposalId);
      }
      throw error;
    }
  } catch (err) {
    return jsonError(err);
  }
}
