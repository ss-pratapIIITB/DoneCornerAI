"use client";

import { useState } from "react";
import {
  activityHeadline,
  groupRunActivity,
  type ActivityStep,
} from "@/lib/runs/activity";
import type { AgentRun, RunEvent } from "@/lib/runs/types";

function stepLabel(step: ActivityStep): string {
  if (step.kind === "sandbox") return "Sandbox";
  if (step.kind === "subagent") return "Subagent";
  if (step.kind === "approval") return "Approval";
  if (step.kind === "mcp") return "MCP";
  return "Tool";
}

function statusLabel(step: ActivityStep): string {
  if (step.status === "failed") return "Failed";
  if (step.status === "waiting") return "Waiting";
  if (step.status === "running") return "Running";
  return "Done";
}

function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const safeKeys = new Set([
    "name",
    "toolCallId",
    "threadId",
    "artifactId",
    "proposalId",
    "status",
    "confidence",
    "rowsWritten",
    "rowsRejected",
    "rowCount",
    "model",
    "allow",
  ]);
  return Object.fromEntries(
    Object.entries(details).filter(([key]) => safeKeys.has(key)),
  );
}

function StepRow({ step }: { step: ActivityStep }) {
  const details = safeDetails(step.details);
  const hasDetails = Object.keys(details).length > 0;
  return (
    <li data-activity-status={step.status}>
      <div className="run-event-line">
        <span>{stepLabel(step)}</span>
        <p>{step.summary}</p>
        <span data-activity-status={step.status}>{statusLabel(step)}</span>
      </div>
      {hasDetails ? (
        <details className="run-event-details">
          <summary>Inspect details</summary>
          <pre>{JSON.stringify(details, null, 2)}</pre>
        </details>
      ) : null}
    </li>
  );
}

export function RunCard({
  run,
  events,
}: {
  run: Pick<AgentRun, "id" | "kind" | "status" | "currentStage">;
  events: RunEvent[];
}) {
  const waiting = run.status === "waiting_approval";
  const steps = groupRunActivity(events);
  const visible = steps.filter((step) => !step.system);
  const system = steps.filter((step) => step.system);
  const failed = steps.filter((step) => step.status === "failed").length;
  const headline = activityHeadline(steps, run.status);
  const [open, setOpen] = useState(waiting || failed > 0);

  return (
    <details
      className="run-card"
      open={open || waiting}
      data-failed={failed > 0 ? "true" : "false"}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span className="run-headline">{headline}</span>
        {failed ? (
          <span className="run-fail-count">
            {failed} failed
          </span>
        ) : null}
        <span className="run-state" data-run-status={run.status}>
          {run.status.replaceAll("_", " ")}
        </span>
      </summary>
      <ol className="run-events">
        {visible.map((step) => (
          <StepRow key={step.key} step={step} />
        ))}
        {system.length ? (
          <li className="run-system-calls">
            <details>
              <summary>
                {system.length} system {system.length === 1 ? "call" : "calls"}
              </summary>
              <ol className="run-events">
                {system.map((step) => (
                  <StepRow key={step.key} step={step} />
                ))}
              </ol>
            </details>
          </li>
        ) : null}
        {!visible.length && !system.length ? (
          <li className="run-empty">Waiting for the first agent event…</li>
        ) : null}
      </ol>
    </details>
  );
}
