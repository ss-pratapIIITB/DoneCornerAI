import { TrueForge } from "@truefoundry/trueforge-sdk";
import { TOOL_NAMES } from "@/mcp/tools";

export const CLOSE_PACK_AGENT = "close-pack";

/** Cheapest OpenAI model registered in the local TrueForge provider catalog. */
export const DEFAULT_TRUEFORGE_MODEL = "openai/gpt-5-4-mini";

export function closePackModel(): string {
  return process.env.TRUEFORGE_MODEL ?? DEFAULT_TRUEFORGE_MODEL;
}

export const CLOSE_PACK_INSTRUCTIONS = `You are the Close Pack agent for DoneCornerAI.

Load the Northstar sample pack or accept an upload. Run P&L, Cash, and Growth analysis in parallel as subagents. Draft widgets onto the personal Close fork. Never overwrite the org Close dashboard. Call request_publish_org with userId and personalId to queue a pending publish; the human Approve button in the portal applies the overwrite.

Click-to-drill in the portal does not go through you. Follow-up questions in the query bar do.`;

export function closePackSpec(modelName: string): TrueForge.AgentSpec {
  return {
    model: { name: modelName },
    instructions: CLOSE_PACK_INSTRUCTIONS,
    config: {
      sandbox: { enabled: true },
      dynamicSubAgents: { enabled: true },
    },
    mcpServers: [
      {
        name: "donecorner",
        enableTools: [...TOOL_NAMES],
        requireApprovalForTools: ["request_publish_org"],
      },
    ],
  };
}
