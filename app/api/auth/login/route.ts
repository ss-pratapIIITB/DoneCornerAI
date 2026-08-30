import { jsonError } from "@/lib/api/http";
import {
  authenticateCredentials,
  sessionCookie,
  signSession,
} from "@/lib/identity/session";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      email?: unknown;
      password?: unknown;
    };
    const user = authenticateCredentials(
      String(body.email ?? ""),
      String(body.password ?? ""),
    );
    if (!user) {
      return Response.json({ error: "Invalid email or password" }, { status: 401 });
    }
    return Response.json(
      { id: user.id },
      { headers: { "set-cookie": sessionCookie(signSession(user.id)) } },
    );
  } catch (err) {
    return jsonError(err);
  }
}
