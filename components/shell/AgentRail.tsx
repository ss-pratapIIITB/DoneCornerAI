"use client";

export type AgentStatus = "idle" | "running" | "waiting_approval" | "done" | "error";

type Props = {
  status: AgentStatus;
  detail: string;
};

const labels: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  waiting_approval: "Waiting for approval",
  done: "Done",
  error: "Error",
};

export function AgentRail({ status, detail }: Props) {
  return (
    <aside className="agent-rail" aria-live="polite">
      <h2>Agent</h2>
      <p data-agent-status={status}>{labels[status]}</p>
      <p className="agent-detail">{detail}</p>
    </aside>
  );
}
