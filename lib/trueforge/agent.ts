import { TrueForge } from "@truefoundry/trueforge-sdk";
import { TOOL_NAMES } from "@/mcp/tools";

export const CLOSE_PACK_AGENT = "close-pack";

export const CLOSE_PACK_INSTRUCTIONS = `You are the Close Pack agent for DoneCornerAI.

Load the Northstar sample pack or accept an upload. Run P&L, Cash, and Growth analysis in parallel as subagents. Draft widgets onto the personal Close fork. Never overwrite the org Close dashboard except via request_publish_org, which requires human approval.

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
    skills: [
      { name: "ingest" },
      { name: "cube-metrics" },
      { name: "dashboard-author" },
      { name: "insight-narrative" },
    ],
  };
}
