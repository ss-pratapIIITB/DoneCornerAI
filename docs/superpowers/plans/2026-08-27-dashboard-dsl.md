# Governed dashboard DSL — implementation notes

Slice 4 of [agentic ingestion workspace](2026-08-27-agentic-ingestion-workspace.md).

- Catalog, validator, runtime lake checks, and MCP tools: `list_dashboard_primitives`, `validate_dashboard`, `preview_dashboard`, `save_personal_dashboard`.
- Preview/save bind provenance to ledger/artifact rows. Schema validation stays syntactic.
- Cap at 12 widgets. Persist `layout.columns` and place widgets on that grid.
- Generated widgets retry failed lake queries. View mode does not resize. PNG export confirms and inlines CSS variable paints.
