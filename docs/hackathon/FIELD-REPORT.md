# Field Report — DoneCornerAI close-pack

Hackathon: [Agent Harness](https://www.wemakedevs.org/hackathons/trueforge), 24–30 Aug 2026.

## Problem

A CFO close is not a chat. Files have to become a cube, charts have to drill without a model, and overwriting the org dashboard has to wait for a person. A wrapper that only narrates numbers would fail the qualification bar.

## Wiring

- **Portal:** Next.js App Router, SQLite cube, Recharts. Click-to-drill is `queryCube` only.
- **Harness:** `@truefoundry/trueforge-sdk` against `http://localhost:8790`. Session id in `localStorage` (`donecorner.tf.session`).
- **MCP:** in-process tools in `mcp/tools.ts` (`load_sample_pack`, `upload_close_file`, `query_cube`, `request_publish_org`, …). `request_publish_org` is the approval-gated tool.
- **Sandbox:** uploads require `TRUEFORGE_SANDBOX=1`. A generated Node cleaner runs in a **child process**, then rows land as `source=upload` inside a transaction. Non-USD rows are skipped; Excel filenames return 4xx. Sample pack load stays deterministic without Daytona.
- **Subagents:** after ingest (HTTP and MCP), P&L / Cash / Growth slices start together (`lib/analysis/subagents.ts`). SQLite queries are synchronous, so they complete on one thread.
- **Approval:** Edit forks a personal board. Publish is pending until an editor (not a viewer) approves or denies.

## What TrueForge handled

Session create/resume, turn streaming for the query bar, `require_approval_for_tools` on org publish, sandbox flag on the close-pack agent spec, skill folders under `skills/`.

## What broke

- Qodo on PR 5: ARR filtered a `scenario` column that does not exist; gross margin and runway were the wrong units; unimplemented metrics fell through to a P&L sum. Fixed in PR 6.
- Qodo on PR 6: `resolve` could be called without a publisher identity. Resolve now requires `canPublish`.
- Qodo on PR 7: naive CSV split, USD relabel, non-atomic upload replace, Excel succeeding with zero rows. Follow-up: recognized zero-row files now clear prior uploads; non-numeric amounts reject the file.
- Sample pack vs sandbox: judges can run without Daytona; uploads must not silently skip the child cleaner.
- Query bar stays disabled when TrueForge is down — by design, so the cube still works.

## Demo evidence

See [`DEMO.md`](DEMO.md). Qualification: MCP tool → sandbox child run → human pause on publish.
