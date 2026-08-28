import { TrueForgeError } from "@truefoundry/trueforge-sdk";
import { trueforge } from "@/lib/trueforge/client";
import {
  CLOSE_PACK_AGENT,
  closePackModel,
  closePackSpec,
} from "@/lib/trueforge/agent";

export function donecornerMcpUrl(origin?: string | null): string {
  if (process.env.DONECORNER_MCP_URL) return process.env.DONECORNER_MCP_URL;
  const trusted = trustedPortalOrigin(origin);
  if (trusted) {
    const host =
      trusted.hostname === "localhost" || trusted.hostname === "::1"
        ? "127.0.0.1"
        : trusted.hostname;
    const port = trusted.port ? `:${trusted.port}` : "";
    return `${trusted.protocol}//${host}${port}/api/mcp`;
  }
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}/api/mcp`;
}

const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1"]);

function trustedPortalOrigin(origin?: string | null): URL | null {
  if (!origin) return null;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    const host = parsed.hostname.toLowerCase();
    if (LOOPBACK.has(host)) return parsed;
    const extra = process.env.DONECORNER_PUBLIC_HOST?.trim().toLowerCase();
    if (extra && host === extra && parsed.protocol === "https:") return parsed;
    return null;
  } catch {
    return null;
  }
}

export async function ensureHarness(origin?: string | null): Promise<void> {
  const client = trueforge();
  await client.settings.mcpServers.createOrUpdate({
    manifest: {
      name: "donecorner",
      description: "Northstar close pack: cube, dashboards, sandbox ingest, publish",
      type: "remote",
      url: donecornerMcpUrl(origin),
    },
  });

  const spec = closePackSpec(closePackModel());

  try {
    await client.agents.create({ name: CLOSE_PACK_AGENT, manifest: spec });
  } catch (err) {
    if (!(err instanceof TrueForgeError) || err.statusCode !== 409) throw err;
    const listed = await client.agents.list();
    const existing = listed.data.find((a) => a.name === CLOSE_PACK_AGENT);
    if (!existing) throw err;
    await client.agents.update(existing.id, { manifest: spec });
  }
}
