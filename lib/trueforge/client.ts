import { TrueForge } from "@truefoundry/trueforge-sdk";
import { hostedFetch } from "@/lib/trueforge/hosted";

function vercelOrigin(): string | null {
  const host = (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    process.env.VERCEL_URL ??
    ""
  )
    .trim()
    .replace(/^https?:\/\//, "");
  return host ? `https://${host}` : null;
}

export function trueforge(): TrueForge {
  const token = process.env.TRUEFORGE_TOKEN;
  return new TrueForge({
    baseUrl: trueforgeBaseUrl(),
    timeoutInSeconds: 600,
    ...(token ? { token } : {}),
    ...(process.env.VERCEL ? { fetch: hostedFetch as typeof fetch } : {}),
  });
}

export function trueforgeBaseUrl(): string {
  if (process.env.TRUEFORGE_BASE_URL) return process.env.TRUEFORGE_BASE_URL;
  if (process.env.VERCEL) return vercelOrigin() ?? "http://localhost:8790";
  return "http://localhost:8790";
}
