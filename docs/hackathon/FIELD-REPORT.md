# Field Report — DoneCornerAI close-pack

Hackathon: [Agent Harness](https://www.wemakedevs.org/hackathons/trueforge), 24–30 Aug 2026.

## Problem

A CFO close is not a chat. Files have to become a cube, charts have to drill without a model, and overwriting the org dashboard has to wait for a person. A wrapper that only narrates numbers would fail the qualification bar.

## Wiring

- **Portal:** Next.js App Router, SQLite cube, Recharts. Click-to-drill is `queryCube` only.
- **Harness:** `@truefoundry/trueforge-sdk` against `http://localhost:8790`. Session id in `localStorage` (`donecorner.tf.session`).
- **MCP:** HTTP JSON-RPC at `/api/mcp`. On session create the portal registers TrueForge connector `donecorner` and agent `close-pack`. Tools include `load_lake`, `inspect_file`, `apply_mapping`, `query_sql`, `present_chart`, dashboard DSL tools, and `request_publish_org`. Approval-gated: `apply_mapping`, `load_lake`, `request_publish_org`.
- **Sandbox:** uploads require `TRUEFORGE_SANDBOX=1`. Inspection can run generated profile code in the TrueForge sandbox. A generated Node cleaner also runs in a **child process** for cube uploads. Non-USD rows are skipped; Excel filenames return 4xx.
- **Subagents:** TrueForge dynamic subagents are enabled on the close-pack spec. Local P&L / Cash / Growth slices still exist in `lib/analysis/subagents.ts` for deterministic fallback.
- **Approval:** Edit forks a personal board. Org publish, canonical `apply_mapping`, and `load_lake` truncate all pause for a person. Editable CFO guidance cannot remove those gates.

## What TrueForge handled

Session create/resume, turn streaming, sandbox flag, dynamic subagents, and `require_approval_for_tools` on `apply_mapping`, `load_lake`, and `request_publish_org`. Skill folders under `skills/` stay in the repo for humans; they are not required in the TrueForge agent (unconfigured skills 422 session create).

## What broke

- Qodo on PR 5: ARR filtered a `scenario` column that does not exist; gross margin and runway were the wrong units; unimplemented metrics fell through to a P&L sum. Fixed in PR 6.
- Qodo on PR 6: `resolve` could be called without a publisher identity. Resolve now requires `canPublish`.
- Qodo on PR 7: naive CSV split, USD relabel, non-atomic upload replace, Excel succeeding with zero rows. Follow-up: recognized zero-row files now clear prior uploads; non-numeric amounts reject the file.
- Sample pack vs sandbox: judges can run without Daytona; uploads must not silently skip the child cleaner.
- Qodo on PR 14: sample-pack could truncate without an approval-tool outcome, send immutable policy as user content, and bind the first prompt version forever. Fixed: `load_lake` consumes a run-bound approval; HTTP confirm no longer truncates; policy lives on the agent spec.
- Query bar stays disabled when TrueForge is down — by design, so last charts still drill. A **new** lake replace will not run until TrueForge can pause on `load_lake`.

## Demo evidence

See [`DEMO.md`](DEMO.md). Qualification: MCP `load_lake` → sandbox on upload inspect → human pause on mapping / lake replace / org publish.
