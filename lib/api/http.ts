import { parseDemoUser } from "@/lib/identity/demo-users";
import { ForbiddenError } from "@/lib/identity/errors";

export function userFromRequest(req: Request) {
  return parseDemoUser(req.headers.get("x-demo-user"));
}

export function jsonError(err: unknown): Response {
  if (err instanceof ForbiddenError) {
    return Response.json({ error: err.message, code: err.code }, { status: 403 });
  }
  const message = err instanceof Error ? err.message : "Unexpected error";
  return Response.json({ error: message }, { status: 400 });
}
