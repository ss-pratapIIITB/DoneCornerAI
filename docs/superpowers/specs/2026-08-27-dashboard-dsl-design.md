# Governed dashboard DSL

Companion to [agentic ingestion workspace](2026-08-27-agentic-ingestion-workspace-design.md) and the original [close pack portal](2026-08-26-close-pack-portal-design.md). Agents may only emit versioned `DashboardSpec` values; the portal renders from a primitive catalog.

## Contract

- Versioned primitives (`kpi`, `variance_kpi`, `bar`, `stacked_bar`, `line`, `waterfall`, `pnl_table`, `exception_queue`, `markdown_insight`).
- Schema validation is syntactic. Preview and save bind `runId` / `eventIds` / `artifactIds` to real ledger and artifact rows; save also requires the same owner.
- At most 12 widgets. Grid `layout.columns` is persisted and used for placement (`x`, `y`, `w`, `h`).
- Live lake query, drill path, purpose, visualization rationale, and provenance are required.
- Agent path: `validate_dashboard` → `preview_dashboard` → `save_personal_dashboard`.

## Approval

Personal drafts auto-save for the owner, including overwrite of that owner's existing draft. Organization publish/overwrite still requires `request_publish_org` and human approval. CSV and PNG widget exports confirm before download.

## View versus edit

The portal opens in view. View inspects, filters, and drills. Resize and layout mutation are edit-only.
