import { TrueForgeError } from "@truefoundry/trueforge-sdk";
import { trueforge } from "@/lib/trueforge/client";
import {
  CLOSE_PACK_AGENT,
  closePackSpec,
} from "@/lib/trueforge/agent";

const MODEL = process.env.TRUEFORGE_MODEL ?? "anthropic/claude-sonnet-4-6";

export function donecornerMcpUrl(): string {
  return process.env.DONECORNER_MCP_URL ?? "http://localhost:3000/api/mcp";
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
    ...closePackSpec(MODEL),
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
