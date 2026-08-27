# Agentic ingestion workspace — implementation plan

**Goal:** Ship one working path where a CFO attaches a finance CSV, TrueForge inspects it through MCP and its sandbox, pauses before canonical loading, then explains the result and can create a validated dashboard.

## Slice 1 — Observable runs

- Add SQLite `agent_runs` and `run_events`.
- Normalize real TrueForge events, including model, MCP, sandbox, subagent, approval, and completion events.
- Append events while turns run and expose replay by sequence.
- Keep the existing turn summary response for compatibility.

## Slice 2 — Agent-owned ingestion

- Store uploads in quarantine and expose only opaque artifact handles.
- Add `inspect_file`, `get_mapping_proposal`, and approval-gated `apply_mapping` MCP tools.
- Bind an approval to the exact proposal hash and write canonical facts plus lineage transactionally.

## Slice 3 — Agent workspace

- Move the composer into the agent rail and support attachments.
- Render assistant Markdown safely.
- Show expandable run activity, sandbox work, tool calls, subagents, and approval detail.
- Restore the workspace from the run ledger after refresh.

## Slice 4 — Agent-designed dashboards

- Add a versioned dashboard primitive catalog and validator.
- Expose catalog, validation, preview, and save tools over MCP.
- Adapt validated specs to the existing widget renderer so drill, export, resize, and fullscreen continue to work.

## Slice 5 — Prompt control and demo path

- Persist editable CFO guidance and expose the assembled policy read-only.
- Route sample loading through the same TrueForge path.
- Verify attach → inspect → sandbox → approval → load → query → chart/dashboard in browser.

## Verification

- Focused unit tests for normalization, ledger ordering/redaction, artifact handles, mapping hashes, and dashboard validation.
- Existing unit suite, lint, typecheck, and production build.
- Browser verification of default view, agent workspace, approvals, drill, and reconnect.
