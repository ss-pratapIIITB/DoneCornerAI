import { TrueForgeError } from "@truefoundry/trueforge-sdk";
import { trueforge } from "@/lib/trueforge/client";
import {
  CLOSE_PACK_AGENT,
  closePackModel,
  closePackSpec,
} from "@/lib/trueforge/agent";

export function donecornerMcpUrl(): string {
  if (process.env.DONECORNER_MCP_URL) return process.env.DONECORNER_MCP_URL;
  const port = process.env.PORT ?? "3000";
  return `http://127.0.0.1:${port}/api/mcp`;
}

export async function ensureHarness(): Promise<void> {
  const client = trueforge();
  await client.settings.mcpServers.createOrUpdate({
    manifest: {
      name: "donecorner",
      description: "Northstar close pack: cube, dashboards, sandbox ingest, publish",
      type: "remote",
      url: donecornerMcpUrl(),
    },
  });

  const spec = {
    ...closePackSpec(closePackModel()),
    config: {
      sandbox: { enabled: true },
      dynamicSubAgents: { enabled: true },
    },
  };

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
