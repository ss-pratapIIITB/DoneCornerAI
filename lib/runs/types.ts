export type RunKind =
  | "question"
  | "file_ingest"
  | "dashboard_revision"
  | "publish";

export type RunStatus =
  | "queued"
  | "running"
  | "waiting_approval"
  | "done"
  | "error"
  | "cancelled";

export type RunEventType =
  | "run.started"
  | "run.completed"
  | "run.failed"
  | "run.cancelled"
  | "run.waiting_approval"
  | "user.message"
  | "message.delta"
  | "message.completed"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "sandbox.created"
  | "subagent.started"
  | "subagent.completed"
  | "subagent.failed"
  | "approval.requested"
  | "mcp.connected"
  | "mcp.auth_required"
  | "artifact.inspected"
  | "mapping.proposed"
  | "mapping.applied";

export type AgentRun = {
  id: string;
  sessionId: string;
  userId: string;
  kind: RunKind;
  status: RunStatus;
  currentStage: string;
  promptVersionId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RunEvent = {
  id: string;
  runId: string;
  sequence: number;
  type: RunEventType;
  stage: string;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
};

export type NewRunEvent = Omit<
  RunEvent,
  "id" | "runId" | "sequence" | "createdAt"
>;
