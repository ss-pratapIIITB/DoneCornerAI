import { parseDemoUser } from "@/lib/identity/demo-users";
import { portalFailureReason } from "@/lib/api/failure";
import { ForbiddenError, UnauthorizedError } from "@/lib/identity/errors";
import { readSessionUserId } from "@/lib/identity/session";
import { SessionBlockedError } from "@/lib/trueforge/gates";

export function userFromRequest(req: Request) {
  const sessionUser = readSessionUserId(req);
  if (sessionUser) return parseDemoUser(sessionUser);
  if (process.env.AUTH_SECRET) {
    throw new UnauthorizedError();
  }
  return parseDemoUser(req.headers.get("x-demo-user"));
}

export { portalFailureReason } from "@/lib/api/failure";

export function jsonError(err: unknown): Response {
  if (err instanceof UnauthorizedError) {
    return Response.json({ error: err.message, code: err.code }, { status: 401 });
  }
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message, code: err.code }, { status: 403 });
  }
  if (err instanceof SessionBlockedError) {
    return Response.json(
      {
        error: err.message,
        code: err.code,
        waitingRunId: err.waitingRunId,
      },
      { status: 409 },
    );
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  const reason = portalFailureReason({ error: message }, message);
  return Response.json({ error: message, reason }, { status: 400 });
}
