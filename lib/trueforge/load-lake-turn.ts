export const LOAD_SAMPLE_DISPLAY =
  "Load the sample Northstar close pack, then chart revenue by period.";

export function loadSampleAgentMessage(runId: string, boardId?: string): string {
  return [
    `Call load_lake with runId=${runId} and userId=cfo, then query_lake revenue by period and present_chart.`,
    `runId=${runId}. userId is cfo.`,
    boardId ? `Current board id: ${boardId}.` : "",
    "Call MCP tools now. Never write that you need approval instead of calling load_lake, apply_mapping, or request_publish_org.",
  ]
    .filter((line) => line.trim())
    .join("\n\n");
}

export function closePackTurnMessage(opts: {
  displayMessage: string;
  runId: string;
  boardId?: string;
  artifactContext?: string;
}): string {
  return [
    opts.displayMessage,
    `runId=${opts.runId}. userId is cfo.`,
    opts.boardId ? `Current board id: ${opts.boardId}.` : "",
    "Use query_lake or query_sql and present_chart.",
    "Call MCP tools now. Never write that you need approval instead of calling load_lake, apply_mapping, or request_publish_org.",
    opts.artifactContext ?? "",
  ]
    .filter((line) => line.trim())
    .join("\n\n");
}
