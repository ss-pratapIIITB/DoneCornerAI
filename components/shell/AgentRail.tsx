"use client";

export type AgentStatus = "idle" | "running" | "waiting_approval" | "done" | "error";

type Props = {
  status: AgentStatus;
  detail: string;
  onApprove?: () => void;
  onDeny?: () => void;
};

const labels: Record<AgentStatus, string> = {
  idle: "Idle",
  running: "Running",
  waiting_approval: "Waiting for approval",
  done: "Done",
  error: "Error",
};

export function AgentRail({ status, detail, onApprove, onDeny }: Props) {
  return (
    <aside className="agent-rail" aria-live="polite">
      <h2>Agent</h2>
      <p data-agent-status={status}>{labels[status]}</p>
      <p className="agent-detail">{detail}</p>
      {status === "waiting_approval" ? (
        <div className="approval-actions">
          <p>Publish will overwrite the org Close dashboard with this personal board.</p>
          <button type="button" onClick={onApprove}>
            Approve publish
          </button>
          <button type="button" className="deny" onClick={onDeny}>
            Deny publish
          </button>
        </div>
      ) : null}
    </aside>
  );
}
