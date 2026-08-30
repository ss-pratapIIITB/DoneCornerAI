import { createHmac, timingSafeEqual } from "node:crypto";
import { parseDemoUser, type DemoUser, type DemoUserId } from "@/lib/identity/demo-users";

export const AUTH_COOKIE = "donecorner.session";
const MAX_AGE_SEC = 60 * 60 * 24 * 14;

function authSecret(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return secret;
}

export function signSession(userId: DemoUserId, now = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ userId, exp: now + MAX_AGE_SEC * 1000 }),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifySession(
  token: string,
): { userId: DemoUserId; exp: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", authSecret()).update(payload).digest("base64url");
  const left = Buffer.from(sig);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
    };
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    if (data.userId !== "cfo" && data.userId !== "fpna" && data.userId !== "viewer") {
      return null;
    }
    return { userId: data.userId, exp: data.exp };
  } catch {
    return null;
  }
}

function cookieAttrs(maxAge: number): string {
  const secure = process.env.VERCEL ? "; Secure" : "";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function sessionCookie(token: string): string {
  return `${AUTH_COOKIE}=${token}; ${cookieAttrs(MAX_AGE_SEC)}`;
}

export function clearSessionCookie(): string {
  return `${AUTH_COOKIE}=; ${cookieAttrs(0)}`;
}

function normalizeLogin(email: string): DemoUserId | null {
  const raw = email.trim().toLowerCase();
  const local = raw.includes("@") ? raw.slice(0, raw.indexOf("@")) : raw;
  if (local === "cfo") return "cfo";
  if (local === "fpna") return "fpna";
  return null;
}

function passwordEqual(provided: string, expected: string): boolean {
  const left = createHmac("sha256", "donecorner.pw").update(provided).digest();
  const right = createHmac("sha256", "donecorner.pw").update(expected).digest();
  return timingSafeEqual(left, right);
}

export function authenticateCredentials(
  email: string,
  password: string,
): DemoUser | null {
  const id = normalizeLogin(email);
  if (!id) return null;
  const expected =
    id === "cfo" ? process.env.AUTH_CFO_PASSWORD : process.env.AUTH_FPNA_PASSWORD;
  if (!expected || !passwordEqual(password, expected)) return null;
  return parseDemoUser(id);
}

export function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname.startsWith("/login/")) return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname === "/api/mcp" || pathname.startsWith("/api/mcp/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export function readSessionUserId(req: { headers: Headers }): DemoUserId | null {
  if (!process.env.AUTH_SECRET) return null;
  const header = req.headers.get("cookie") ?? "";
  const match = header.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  return verifySession(decodeURIComponent(match[1]))?.userId ?? null;
}
