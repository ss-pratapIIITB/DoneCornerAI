import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, isPublicPath, verifySession } from "@/lib/identity/session";

export function proxy(request: NextRequest) {
  if (!process.env.AUTH_SECRET) return NextResponse.next();
  const path = request.nextUrl.pathname;
  if (isPublicPath(path)) return NextResponse.next();
  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (token && verifySession(token)) return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `next=${encodeURIComponent(path)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
