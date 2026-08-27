"use client";

import { useState } from "react";
import type { AgentRun, RunEvent } from "@/lib/runs/types";

const EVENT_LABELS: Partial<Record<RunEvent["type"], string>> = {
  "run.started": "Run",
  "user.message": "Input",
  "message.completed": "Agent",
  "tool.started": "Tool",
  "tool.completed": "Tool",
  "tool.failed": "Tool",
  "sandbox.created": "Sandbox",
  "subagent.started": "Subagent",
  "subagent.completed": "Subagent",
  "subagent.failed": "Subagent",
  "approval.requested": "Approval",
  "mcp.connected": "MCP",
  "mcp.auth_required": "MCP",
  "artifact.inspected": "File",
  "mapping.proposed": "Mapping",
  "mapping.applied": "Mapping",
  "run.waiting_approval": "Run",
  "run.completed": "Run",
  "run.failed": "Run",
  "run.cancelled": "Run",
};

function eventDetails(event: RunEvent): Record<string, unknown> {
  const details = { ...event.details };
  delete details.content;
  return details;
}

export function RunCard({
  run,
  events,
}: {
  run: Pick<AgentRun, "id" | "kind" | "status" | "currentStage">;
  events: RunEvent[];
}) {
  const active = run.status === "running" || run.status === "waiting_approval";
  const [open, setOpen] = useState(active);
  const visible = events.filter(
    (event) => event.type !== "message.delta" && event.type !== "user.message",
  );
  return (
    <details
      className="run-card"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>Agent activity</span>
        <span className="run-stage">{run.currentStage.replaceAll("_", " ")}</span>
        <span className="run-state" data-run-status={run.status}>
          {run.status.replaceAll("_", " ")}
        </span>
      </summary>
      <ol className="run-events">
        {visible.length ? (
          visible.map((event) => {
            const details = eventDetails(event);
            const hasDetails = Object.keys(details).length > 0;
            return (
              <li key={event.id} data-event-type={event.type}>
                <div className="run-event-line">
                  <span>{EVENT_LABELS[event.type] ?? "Agent"}</span>
                  <p>{event.summary}</p>
                  <time dateTime={event.createdAt}>
                    {new Date(event.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
                {hasDetails ? (
                  <details className="run-event-details">
                    <summary>Inspect details</summary>
                    <pre>{JSON.stringify(details, null, 2)}</pre>
                  </details>
                ) : null}
              </li>
            );
          })
        ) : (
          <li className="run-empty">Waiting for the first agent event…</li>
        )}
      </ol>
    </details>
  );
}
