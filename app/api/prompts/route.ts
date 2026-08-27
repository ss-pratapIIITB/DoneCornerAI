import { jsonError, userFromRequest } from "@/lib/api/http";
import { getDb, migrate } from "@/lib/db/sqlite";
import { ForbiddenError } from "@/lib/identity/errors";
import {
  assemblePrompt,
  ensureDefaultGuidance,
  listPromptVersions,
  restorePromptVersion,
  savePromptGuidance,
} from "@/lib/prompts/assembly";
import { CLOSE_PACK_AGENT, closePackModel } from "@/lib/trueforge/agent";

export const runtime = "nodejs";

function payload(db: ReturnType<typeof getDb>, ownerId: string) {
  const guidance = ensureDefaultGuidance(db, ownerId);
  return {
    guidance,
    versions: listPromptVersions(db, ownerId),
    assembled: assemblePrompt({ guidance }),
    model: closePackModel(),
    agent: CLOSE_PACK_AGENT,
  };
}

export async function GET(req: Request): Promise<Response> {
  const user = userFromRequest(req);
  const db = getDb();
  migrate(db);
  return Response.json(payload(db, user.id));
}

export async function POST(req: Request): Promise<Response> {
  try {
    const user = userFromRequest(req);
    if (!user.canEdit) throw new ForbiddenError();
    const db = getDb();
    migrate(db);
    const body = (await req.json()) as {
      action?: string;
      versionId?: string;
      objective?: string;
      businessContext?: string;
      materiality?: string;
      dashboardPreferences?: string;
    };
    if (body.action === "restore") {
      restorePromptVersion(db, user.id, String(body.versionId ?? ""));
    } else {
      savePromptGuidance(db, {
        ownerId: user.id,
        objective: String(body.objective ?? ""),
        businessContext: String(body.businessContext ?? ""),
        materiality: String(body.materiality ?? ""),
        dashboardPreferences: String(body.dashboardPreferences ?? ""),
      });
    }
    return Response.json(payload(db, user.id));
  } catch (error) {
    return jsonError(error);
  }
}
