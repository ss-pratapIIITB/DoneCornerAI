"use client";

import { useState } from "react";
import { AgentComposer } from "@/components/shell/AgentComposer";
import { MarkdownReply } from "@/components/shell/MarkdownReply";
import { PromptWorkspace } from "@/components/shell/PromptWorkspace";
import { RunCard } from "@/components/shell/RunCard";
import type { AgentRun, RunEvent } from "@/lib/runs/types";

export type AgentStatus = "idle" | "running" | "waiting_approval" | "done" | "error";

type Props = {
  status: AgentStatus;
  detail: string;
  turns?: AgentTurn[];
  pendingActions?: string[];
  pendingKind?: "approval" | "question" | "publish";
  disabled?: boolean;
  disabledReason?: string;
  canEditPrompt?: boolean;
  onSubmit?: (message: string, files: File[]) => Promise<void>;
  onApprove?: () => void;
  onDeny?: () => void;
};

export type AgentTurn = {
  id: string;
  q: string;
  a: string;
  attachments?: { id: string; name: string }[];
  run?: AgentRun;
  events?: RunEvent[];
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
  pendingKind,
  disabled,
  disabledReason,
  canEditPrompt,
  onSubmit,
  onApprove,
  onDeny,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const isApproval = status === "waiting_approval";
  const isQuestion = pendingKind === "question";
  const actionLabel = pendingActions?.length
    ? pendingActions.join(", ")
    : isQuestion
      ? "Agent question"
      : "Sensitive action";
  const isPublish =
    pendingKind === "publish" ||
    pendingActions?.some((action) => action.toLowerCase().includes("publish")) ||
    detail.toLowerCase().includes("publish");

  return (
    <aside
      className="agent-rail"
      aria-live="polite"
      data-expanded={expanded || isApproval || promptOpen}
    >
      <div className="agent-rail-head">
        <button
          type="button"
          className="agent-rail-toggle"
          aria-expanded={expanded || isApproval || promptOpen}
          onClick={() => setExpanded((value) => !value)}
        >
          <h2>TrueForge agent</h2>
          <span className="agent-status" data-agent-status={status}>
            {labels[status]}
          </span>
        </button>
        <button
          type="button"
          className="prompt-open"
          aria-expanded={promptOpen}
          onClick={() => {
            setPromptOpen((value) => !value);
            setExpanded(true);
          }}
        >
          Prompt
        </button>
      </div>
      <div className="agent-capabilities" aria-label="Agent capabilities">
        <span>MCP linked</span>
        <span>Sandbox ready</span>
        <span>Session persistent</span>
      </div>
      {promptOpen ? <PromptWorkspace canEdit={Boolean(canEditPrompt)} /> : null}
      <div className="agent-transcript">
        {turns?.length
          ? turns.map((t) => (
              <article key={t.id} className="turn">
                <p className="turn-q">{t.q}</p>
                {t.attachments?.length ? (
                  <ul className="turn-files" aria-label="Files sent to the agent">
                    {t.attachments.map((file) => (
                      <li key={file.id}>{file.name}</li>
                    ))}
                  </ul>
                ) : null}
                {t.a ? <MarkdownReply>{t.a}</MarkdownReply> : null}
                {t.run ? (
                  <RunCard run={t.run} events={t.events ?? []} />
                ) : null}
              </article>
            ))
          : null}
        {!turns?.length || detail !== turns.at(-1)?.a ? (
          <div className="agent-detail">
            <MarkdownReply>{detail}</MarkdownReply>
          </div>
        ) : null}
      </div>
      {isApproval ? (
        <div className="approval-actions">
          <p>
            {isQuestion ? (
              <>
                <strong>{actionLabel}</strong> paused the session. Continue to
                make the agent use the lake, or stop this turn.
              </>
            ) : (
              <>
                <strong>{actionLabel}</strong> requires your approval. Review the
                agent detail above before continuing.
              </>
            )}
          </p>
          <button type="button" onClick={onApprove}>
            {isQuestion ? "Continue" : isPublish ? "Approve publish" : "Approve action"}
          </button>
          <button type="button" className="deny" onClick={onDeny}>
            {isQuestion ? "Stop" : isPublish ? "Deny publish" : "Deny action"}
          </button>
        </div>
      ) : null}
      {onSubmit ? (
        <AgentComposer
          disabled={
            disabled || status === "running" || status === "waiting_approval"
          }
          reason={
            status === "running"
              ? "The agent is working. You can inspect live activity above."
              : status === "waiting_approval"
                ? "Resolve the pending action before starting another run."
              : disabledReason
          }
          onSubmit={onSubmit}
        />
      ) : null}
    </aside>
  );
}
