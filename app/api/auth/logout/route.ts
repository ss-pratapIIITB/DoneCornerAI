import { clearSessionCookie } from "@/lib/identity/session";

export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  return new Response(null, {
    status: 303,
    headers: {
      "set-cookie": clearSessionCookie(),
      location: "/login",
    },
  });
}
