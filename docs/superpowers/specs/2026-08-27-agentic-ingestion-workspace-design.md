# Agentic Ingestion and Observable Workspace Design

**Date:** 2026-08-27  
**Status:** Approved design, pending written-spec review  
**Scope:** One vertical slice from file attachment through a TrueForge-designed personal dashboard

## Problem

DoneCornerAI currently looks more agentic than it is.

- The sample pack is loaded by direct portal API calls.
- Uploaded CSVs are stored locally, cleaned by a generated local child-process script, inserted into SQLite, and followed by deterministic parallel queries.
- The functions named “subagents” are local `Promise.all` work, not TrueForge delegation.
- Initial charts are portal-owned queries. Only charts explicitly requested in chat can originate from `present_chart`.
- TrueForge turn events are collapsed into final text, pending approvals, and chart specs. Tool calls, sandbox work, artifacts, delegation, and decisions are discarded.
- The agent prompt is hard-coded and replies render as plain text.
- The message composer is separated from the agent transcript.

This weakens both the product experience and the hackathon evidence. Judges must be able to see TrueForge inspect a real file, run code in its sandbox, call MCP tools, delegate analysis, make a dashboard decision, preserve the session, and pause before a consequential write.

## Goals

1. Make TrueForge the orchestrator for file processing, analysis, chart selection, and dashboard composition.
2. Expose an auditable, well-packaged execution record without exposing private chain-of-thought.
3. Let the agent design dashboards from a governed, extensible visual primitive catalog.
4. Keep every generated chart backed by a live lake query with drill and lineage metadata.
5. Put text input, file attachment, run activity, approvals, Markdown replies, and generated artifacts in one agent workspace.
6. Make CFO guidance editable and versioned while keeping safety and tool policy immutable.
7. Preserve fast deterministic interactions where model reasoning adds no value.

## Non-goals

- Displaying raw hidden chain-of-thought.
- Sending raw file bytes through prompts or MCP JSON arguments.
- Letting the model generate arbitrary React components.
- Routing chart drill, filter, export, resize, or fullscreen interactions through the model.
- Allowing an agent to overwrite an organization dashboard without human approval.
- Building a general-purpose ETL platform in this slice.

## Product Decisions

- Use a **TrueForge run ledger** architecture.
- Automatically inspect, profile, and clean files in the sandbox.
- Pause on the proposed mapping before writing canonical lake facts.
- Expose editable CFO guidance and dashboard preferences.
- Show the complete assembled prompt, safety policy, and tool policy read-only.
- Automatically save valid generated dashboards as personal drafts.
- Continue requiring approval for organization publish/overwrite, sensitive export, delete, and equivalent irreversible operations.

## Architecture

### Execution source of truth

TrueForge owns the persistent session and agent execution. The portal creates or resumes a session, starts a turn, and consumes the turn as a stream rather than waiting for one collapsed response.

### Portal run ledger

The server normalizes TrueForge events into durable `RunEvent` records for rendering and reconnect. The ledger is an observation and recovery layer; it does not simulate execution or replace the TrueForge session.

Suggested control-plane records:

```ts
type AgentRun = {
  id: string;
  sessionId: string;
  userId: string;
  kind: "file_ingest" | "question" | "dashboard_revision" | "publish";
  status: "queued" | "running" | "waiting_approval" | "done" | "partial" | "error" | "cancelled";
  currentStage: string;
  createdAt: string;
  updatedAt: string;
};

type RunEvent = {
  id: string;
  runId: string;
  sequence: number;
  type:
    | "run.started"
    | "decision.summary"
    | "tool.started"
    | "tool.completed"
    | "sandbox.started"
    | "sandbox.completed"
    | "subagent.started"
    | "subagent.completed"
    | "artifact.created"
    | "approval.required"
    | "approval.resolved"
    | "message.delta"
    | "run.completed"
    | "run.failed";
  stage: string;
  summary: string;
  details: Record<string, unknown>;
  createdAt: string;
};
```

The existing SQLite database may hold control-plane records. Canonical financial facts, entities, lake objects, and lineage remain in Postgres.

### Upload quarantine

The portal accepts a file, validates its size and type, writes it to a quarantined server-side store, computes a checksum, and returns an opaque artifact handle. The browser and model receive metadata and the handle, never the server path.

```ts
type FileArtifact = {
  id: string;
  ownerId: string;
  filename: string;
  mediaType: string;
  bytes: number;
  sha256: string;
  status: "quarantined" | "inspected" | "mapped" | "loaded" | "rejected";
};
```

## Agentic File Flow

1. The user attaches one or more files in the agent composer.
2. The portal stores them in quarantine and starts a persistent TrueForge `file_ingest` run with artifact handles and CFO guidance.
3. The parent agent calls MCP tools to inspect file metadata and sample data.
4. Generated inspection and normalization code executes in the real TrueForge sandbox.
5. The agent emits concise decision summaries at meaningful checkpoints: recognized dataset, assumptions, mapping alternatives, anomalies, confidence, and planned next action.
6. The agent creates a structured mapping proposal. The proposal lists source-to-target fields, transformations, ignored rows, invalid values, replacements, data-loss risks, and expected canonical row counts.
7. The run enters `waiting_approval`. The portal shows an exact mapping diff and approve, revise, and deny actions.
8. Approval resumes the same TrueForge session and authorizes `apply_mapping`.
9. `apply_mapping` validates the approved proposal again and writes Postgres facts and lineage in one transaction with an idempotency key.
10. The parent agent delegates only relevant analysis slices to actual TrueForge subagents. Initial roles are P&L, cash, growth, and anomaly analysis; absent datasets do not spawn irrelevant work.
11. The parent agent combines returned evidence, queries the dashboard primitive catalog, creates a dashboard specification, validates it, previews it, and saves a personal draft.
12. The final reply includes formatted analysis, evidence references, live charts, the generated dashboard artifact, and suggested follow-ups.

The sample-pack action follows this same flow. It may use trusted bundled artifacts, but it must still start a visible TrueForge run and exercise sandbox, MCP, delegation, dashboard design, and approval.

## MCP Tool Surface

### File and mapping tools

- `inspect_file({ artifactId })`: metadata, sheets/delimiters, row/column counts, encoding, and safe sample references.
- `profile_dataset({ artifactId, options })`: nulls, types, cardinality, numeric ranges, candidate keys, periods, currencies, and anomalies. Uses TrueForge sandbox execution.
- `get_mapping_proposal({ runId })`: returns the current structured proposal.
- `apply_mapping({ proposalId, approvalId, idempotencyKey })`: approval-gated transactional canonical write.
- `get_lineage({ artifactId | factId })`: source, transformation, run, and approval trace.

### Analysis and query tools

- Keep `query_lake` and guarded read-only `query_sql`.
- Keep `describe_schema`, but extend it with lineage and supported semantic metrics.
- Remove the local fake-subagent path from production orchestration.

### Dashboard tools

- `list_dashboard_primitives({ version })`
- `validate_dashboard({ dashboard })`
- `preview_dashboard({ dashboard })`
- `save_personal_dashboard({ userId, dashboard })`
- `request_publish_org({ userId, personalId })`

Tools return structured artifacts suitable for both the model and the event ledger. Tool arguments and outputs are redacted before browser delivery.

## Observable Reasoning

The portal must not expose raw private chain-of-thought. It must expose useful execution evidence:

- concise decision summary;
- assumptions and confidence;
- alternatives considered and why one was selected;
- tool name, sanitized arguments, duration, status, and output summary;
- sandbox program metadata, execution status, stdout/stderr summary, and artifacts;
- subagent role, task, state, and returned evidence;
- exact approval request and impact;
- query and lineage references used by each conclusion or chart.

Repetitive low-level events are grouped. Each run supports:

- **Summary:** decisions, stages, material tools, artifacts, approvals, and final outcome;
- **Full activity:** every normalized event plus optional sanitized raw JSON.

## Agent Workspace UX

The existing TrueForge rail becomes the unified workspace.

### Transcript

- User and assistant messages appear in chronological order.
- Assistant text renders sanitized GitHub-flavored Markdown, including headings, lists, tables, code, and links.
- Evidence references open the matching run event, query, artifact, or lineage record.
- Generated charts render inline with the reply.

### Composer

- Sticky at the bottom of the workspace.
- Supports text, multiple file attachments, remove/retry, and submission state.
- Replaces the separate top-bar query input.
- Preserves the current session across refresh and reconnect.

### Run cards

Each turn has one expandable card showing status, current stage, elapsed time, artifact count, and approval state. Inside are decision, tools, sandbox, subagents, artifacts, and approval sections. Tool and sandbox details default collapsed; material failures and approvals default expanded.

### Prompt settings

The agent header opens a prompt workspace with:

- editable CFO objective;
- editable business context;
- editable materiality and exception rules;
- editable dashboard preferences;
- version history and restore;
- read-only assembled prompt;
- read-only immutable safety policy;
- read-only tool and approval policy;
- active model and agent configuration.

Saving guidance creates a new version. Existing runs retain the prompt version they used.

## Prompt Assembly

The effective prompt is assembled in this order:

1. immutable product role and safety policy;
2. immutable tool capabilities and approval policy;
3. versioned editable CFO/business guidance;
4. versioned editable dashboard preferences;
5. current run context, artifact handles, board ID, and prompt version;
6. user message.

The full assembled result is visible read-only. Editable content cannot remove approval requirements, broaden filesystem access, expose secrets, or change MCP allowlists.

## Dashboard Design System

### Versioned DSL

The model produces a dashboard specification, not JSX:

```ts
type DashboardSpec = {
  version: 1;
  name: string;
  purpose: string;
  layout: { columns: number; density: "compact" | "standard" };
  widgets: DashboardWidgetSpec[];
};

type DashboardWidgetSpec = {
  id: string;
  primitive: string;
  title: string;
  purpose: string;
  whyThisVisualization: string;
  query: LakeQuery;
  drill: { path: LakeGrain[] };
  position: { x: number; y: number; w: number; h: number };
  provenance: { runId: string; eventIds: string[]; artifactIds: string[] };
};
```

### Initial primitive catalog

- KPI
- variance KPI
- bar
- stacked bar
- line
- waterfall/bridge
- P&L table
- exception queue
- Markdown insight

Each primitive declares supported data shapes, maximum points, drill behavior, sizing constraints, export support, accessibility requirements, and renderer version.

### Composition guidance

The catalog offers optional composition guidance for executive close, variance investigation, cash runway, and blank/custom dashboards. These are not fixed templates. The agent chooses hierarchy and layout from the evidence and editable preferences.

### Validation

Before preview or save, validation rejects:

- unknown primitive or renderer version;
- unsupported metric or grain;
- unsafe SQL or unavailable field;
- incompatible data shape;
- excessive points;
- missing accessible title or purpose;
- invalid drill path;
- overlapping or out-of-bounds layout;
- missing provenance.

Charts remain dynamic because widget specs reference live lake queries. The agent chooses and creates the chart specification; the portal renderer executes the query and supports deterministic drill/filter interactions.

## Approval and Safety

Approval is required before:

- applying a proposed mapping to canonical facts;
- replacing previously loaded canonical data;
- publishing or overwriting an organization dashboard;
- exporting sensitive data;
- deleting data or artifacts.

The approval panel names the tool, target, affected rows or dashboard, replacements, rejected data, and rollback behavior. Approval is bound to a proposal hash so a changed proposal requires new approval.

`apply_mapping` uses:

- schema validation;
- ownership checks;
- proposal hash verification;
- transaction rollback;
- idempotency key;
- lineage writes in the same transaction;
- audit event after commit.

## Error and Recovery Behavior

- Unsupported file: preserve artifact, explain accepted formats, offer replacement.
- Sandbox failure: show stderr summary, keep artifact, retry the stage without restarting the session.
- Low-confidence mapping: require revision or explicit approval with warnings.
- Denied mapping: preserve proposal and artifact; allow guided revision.
- Transaction failure: roll back all facts and lineage; expose retry.
- Subagent failure: mark the slice incomplete; never fabricate analysis. Parent may produce a labeled partial result.
- Invalid dashboard: show validator findings to the agent, permit bounded repair, and keep the previous personal draft.
- Disconnect: reconnect to the run ledger and TrueForge session from the last sequence number.
- Cancellation: stop optional work, preserve completed artifacts, and record a terminal event.

## Testing

### Unit

- TrueForge event normalization and ordering
- event redaction
- prompt assembly, immutability, versioning, and read-only rendering
- upload handle ownership and path isolation
- mapping schema and proposal hash
- transaction and idempotency behavior
- dashboard primitive registry and validator
- Markdown sanitization
- chart query and provenance retention

### Integration

- streamed turn events persist and replay
- real MCP tools receive handles rather than raw bytes
- sandbox inspection produces a profile artifact
- approval resumes the same TrueForge session
- approved mapping writes facts and lineage atomically
- relevant TrueForge subagents are delegated and collected
- dashboard repair loop terminates within a bounded retry count

### Browser acceptance

1. Attach a CSV in the agent composer.
2. Observe file inspection, sandbox execution, MCP calls, and subagent stages.
3. Expand a tool call and inspect sanitized arguments and output.
4. Review and approve the proposed mapping.
5. Receive a Markdown-formatted response and agent-designed live dashboard.
6. Drill a generated chart without invoking a model turn.
7. Refresh and recover transcript, activity, artifacts, and session.
8. Edit CFO guidance and inspect the full assembled prompt read-only.
9. Request organization publish and approve the exact operation.

Separate acceptance tests cover deny, malformed file, sandbox failure, invalid dashboard, reconnect, cancellation, sensitive export, and partial subagent failure.

## Migration

1. Add durable run/event, artifact, mapping, prompt-version, and lineage records.
2. Add normalized streaming from TrueForge to the portal.
3. Add handle-based sandbox/MCP ingestion tools and mapping approval.
4. Replace local fake subagents with TrueForge delegation.
5. Add dashboard DSL, primitive registry, validator, and live renderer contract.
6. Move the composer into the agent workspace and add expandable activity.
7. Add Markdown rendering and prompt settings.
8. Route the sample-pack demo through the same agent flow.
9. Remove production use of direct route orchestration and the local child-process sandbox after parity tests pass.

## Success Criteria

- A judge can watch TrueForge inspect a real file, execute sandbox code, call MCP, delegate analysis, request mapping approval, and produce a live dashboard without opening developer tools.
- Every visible processing claim maps to a persisted TrueForge-derived event.
- Every generated chart has a live query, drill path, rationale, and provenance.
- Prompt guidance is editable and versioned; the complete effective prompt and immutable policies are visible read-only.
- Refresh and reconnect preserve the session and run ledger.
- No raw private chain-of-thought, file bytes, secrets, or unrestricted server paths appear in the UI or model prompt.
