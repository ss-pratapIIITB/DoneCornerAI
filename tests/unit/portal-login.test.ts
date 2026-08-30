import { afterEach, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest } from "next/server";
import { UnauthorizedError } from "@/lib/identity/errors";
import { userFromRequest } from "@/lib/api/http";
import {
  AUTH_COOKIE,
  authenticateCredentials,
  isPublicPath,
  readSessionUserId,
  sessionCookie,
  signSession,
  verifySession,
} from "@/lib/identity/session";
import { LoginForm } from "@/components/shell/LoginForm";
import { POST as login } from "@/app/api/auth/login/route";
import { config as proxyFileConfig, proxy } from "../../proxy";

describe("portal login session", () => {
  afterEach(() => {
    delete process.env.AUTH_SECRET;
    delete process.env.AUTH_CFO_PASSWORD;
  });

  it("signs a session that round-trips the CFO", () => {
    process.env.AUTH_SECRET = "test-secret-for-hmac";
    const token = signSession("cfo");
    expect(verifySession(token)?.userId).toBe("cfo");
    expect(verifySession("not-a-token")).toBeNull();
    expect(verifySession(`${token}x`)).toBeNull();
  });

  it("authenticates the CFO against env credentials", () => {
    process.env.AUTH_CFO_PASSWORD = "correct-horse";
    expect(authenticateCredentials("cfo@donecorner.ai", "correct-horse")?.id).toBe(
      "cfo",
    );
    expect(authenticateCredentials("cfo", "correct-horse")?.id).toBe("cfo");
    expect(authenticateCredentials("cfo@donecorner.ai", "wrong")).toBeNull();
    expect(authenticateCredentials("viewer@donecorner.ai", "correct-horse")).toBeNull();
  });

  it("leaves login, auth, and MCP public so TrueForge can still reach tools", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/api/auth/login")).toBe(true);
    expect(isPublicPath("/api/mcp")).toBe(true);
    expect(isPublicPath("/")).toBe(false);
    expect(isPublicPath("/api/dashboards")).toBe(false);
  });

  it("sets a session cookie on a valid login", async () => {
    process.env.AUTH_SECRET = "test-secret-for-hmac";
    process.env.AUTH_CFO_PASSWORD = "correct-horse";
    const res = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "cfo@donecorner.ai", password: "correct-horse" }),
      }),
    );
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain(`${AUTH_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
  });

  it("reads the signed user from the session cookie when AUTH_SECRET is set", () => {
    process.env.AUTH_SECRET = "test-secret-for-hmac";
    const token = signSession("fpna");
    const req = new Request("http://localhost/api/dashboards", {
      headers: { cookie: sessionCookie(token).split(";")[0] },
    });
    expect(readSessionUserId(req)).toBe("fpna");
    expect(userFromRequest(req).id).toBe("fpna");
    expect(() =>
      userFromRequest(new Request("http://localhost/api/dashboards")),
    ).toThrow(UnauthorizedError);
  });

  it("exports a Next proxy matcher", () => {
    expect(proxyFileConfig.matcher).toEqual([
      "/((?!_next/static|_next/image|favicon.ico).*)",
    ]);
  });

  it("redirects the board to login when AUTH_SECRET is set and the cookie is missing", () => {
    process.env.AUTH_SECRET = "test-secret-for-hmac";
    const res = proxy(new NextRequest("http://localhost/"));
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("returns 401 for APIs without a session and leaves MCP open", () => {
    process.env.AUTH_SECRET = "test-secret-for-hmac";
    const api = proxy(new NextRequest("http://localhost/api/dashboards"));
    expect(api.status).toBe(401);
    const mcp = proxy(new NextRequest("http://localhost/api/mcp"));
    expect(mcp.status).toBe(200);
  });

  it("renders a password login form", () => {
    const html = renderToStaticMarkup(createElement(LoginForm));
    expect(html).toMatch(/type="password"/);
    expect(html).toMatch(/Sign in|Log in/i);
    const css = readFileSync(join(process.cwd(), "app/signal-room.css"), "utf8");
    expect(css).toMatch(/\.login-screen/);
  });
});
