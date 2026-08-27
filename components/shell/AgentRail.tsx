"use client";

import { useState } from "react";

export type AgentStatus = "idle" | "running" | "waiting_approval" | "done" | "error";

type Props = {
  status: AgentStatus;
  detail: string;
  turns?: { q: string; a: string }[];
  pendingActions?: string[];
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

export function AgentRail({
  status,
  detail,
  turns,
  pendingActions,
  onApprove,
  onDeny,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const isApproval = status === "waiting_approval";
  const actionLabel = pendingActions?.length
    ? pendingActions.join(", ")
    : "Sensitive action";
  const isPublish =
    pendingActions?.some((action) => action.toLowerCase().includes("publish")) ||
    detail.toLowerCase().includes("publish");

  return (
    <aside
      className="agent-rail"
      aria-live="polite"
      data-expanded={expanded || isApproval}
    >
      <div className="agent-rail-head">
        <button
          type="button"
          className="agent-rail-toggle"
          aria-expanded={expanded || isApproval}
          onClick={() => setExpanded((value) => !value)}
        >
          <h2>TrueForge agent</h2>
          <span className="agent-status" data-agent-status={status}>
            {labels[status]}
          </span>
        </button>
      </div>
      <div className="agent-capabilities" aria-label="Agent capabilities">
        <span>MCP linked</span>
        <span>Sandbox ready</span>
        <span>Session persistent</span>
      </div>
      <div className="agent-transcript">
        {turns?.length
          ? turns.map((t, i) => (
              <article key={i} className="turn">
                <p className="turn-q">{t.q}</p>
                <p className="turn-a">{t.a}</p>
              </article>
            ))
          : null}
        {!turns?.length || detail !== turns.at(-1)?.a ? (
          <p className="agent-detail">{detail}</p>
        ) : null}
      </div>
      {isApproval ? (
        <div className="approval-actions">
          <p>
            <strong>{actionLabel}</strong> requires your approval. Review the agent
            detail above before continuing.
          </p>
          <button type="button" onClick={onApprove}>
            {isPublish ? "Approve publish" : "Approve action"}
          </button>
          <button type="button" className="deny" onClick={onDeny}>
            {isPublish ? "Deny publish" : "Deny action"}
          </button>
        </div>
      ) : null}
    </aside>
  );
}
