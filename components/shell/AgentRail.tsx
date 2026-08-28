"use client";

import { useEffect, useRef, useState } from "react";
import { AgentChartBlock, type AgentChartSpec } from "@/components/dashboard/AgentChartBlock";
import { AgentComposer } from "@/components/shell/AgentComposer";
import { MarkdownReply } from "@/components/shell/MarkdownReply";
import { PromptWorkspace } from "@/components/shell/PromptWorkspace";
import { RunCard } from "@/components/shell/RunCard";
import type { LakeQuery } from "@/lib/lake/types";
import { chartsFromRunEvents } from "@/lib/runs/replay";
import { stickToTranscriptBottom, transcriptScrollBehavior } from "@/lib/shell/transcript-scroll";
import type { AgentRun, RunEvent } from "@/lib/runs/types";

export type AgentStatus = "idle" | "running" | "waiting_approval" | "done" | "error";

type Props = {
  status: AgentStatus;
  detail: string;
  turns?: AgentTurn[];
  pendingActions?: string[];
  pendingKind?: "approval" | "question" | "publish";
  busy?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  canEditPrompt?: boolean;
  canPin?: boolean;
  onSubmit?: (message: string, files: File[]) => Promise<void>;
  onPinChart?: (chart: AgentChartSpec, boardId?: string) => Promise<void>;
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

function specsFromEvents(events: RunEvent[]): AgentChartSpec[] {
  return chartsFromRunEvents(events).map((chart) => ({
    title: chart.title,
    query: {
      metric: String(chart.query.metric ?? "revenue"),
      grain: String(chart.query.grain ?? "period") as LakeQuery["grain"],
      filters: (chart.query.filters ?? {
        scenario: "actual",
      }) as LakeQuery["filters"],
    },
    rows: chart.rows,
  }));
}

function TurnCharts({
  events,
  canPin,
  onPinChart,
}: {
  events: RunEvent[];
  canPin?: boolean;
  onPinChart?: (chart: AgentChartSpec, boardId?: string) => Promise<void>;
}) {
  const charts = specsFromEvents(events);
  if (!charts.length) return null;
  return (
    <div className="turn-charts">
      {charts.map((chart, index) => (
        <AgentChartBlock
          key={`${chart.title}-${index}`}
          spec={chart}
          compact
          canPin={Boolean(canPin && onPinChart)}
          onPin={(boardId) => onPinChart?.(chart, boardId) ?? Promise.resolve()}
        />
      ))}
    </div>
  );
}

export function AgentRail({
  status,
  detail,
  turns,
  pendingActions,
  pendingKind,
  busy,
  disabled,
  disabledReason,
  canEditPrompt,
  canPin,
  onSubmit,
  onPinChart,
  onApprove,
  onDeny,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);
  const transcript = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const isApproval = status === "waiting_approval";
  const hasCharts = Boolean(
    turns?.some((turn) => specsFromEvents(turn.events ?? []).length),
  );
  const railOpen = expanded || isApproval || promptOpen || hasCharts;
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

  useEffect(() => {
    const node = transcript.current;
    if (!node || !stick.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const id = window.setTimeout(() => {
      const el = transcript.current;
      if (!el || !stick.current) return;
      el.scrollTo({
        top: el.scrollHeight,
        behavior: transcriptScrollBehavior(status, reduce),
      });
    }, reduce ? 0 : 80);
    return () => window.clearTimeout(id);
  }, [turns, detail, status]);

  return (
    <aside
      className="agent-rail"
      aria-live="polite"
      data-expanded={railOpen}
    >
      <div className="agent-rail-head">
        <button
          type="button"
          className="agent-rail-toggle"
          aria-expanded={railOpen}
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
      <div
        className="agent-transcript"
        data-agent-transcript
        ref={transcript}
        onScroll={(event) => {
          stick.current = stickToTranscriptBottom(event.currentTarget);
        }}
      >
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
                <TurnCharts
                  events={t.events ?? []}
                  canPin={canPin}
                  onPinChart={onPinChart}
                />
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
          <button type="button" onClick={onApprove} disabled={busy}>
            {busy
              ? isQuestion
                ? "Continuing…"
                : "Approving…"
              : isQuestion
                ? "Continue"
                : isPublish
                  ? "Approve publish"
                  : "Approve action"}
          </button>
          <button type="button" className="deny" onClick={onDeny} disabled={busy}>
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
