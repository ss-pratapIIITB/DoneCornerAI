# Office of the CTO

CFO intelligence portal for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (24–30 August 2026).

The product is a **close-pack agent**: drop P&L / cash / budget files (or load the shipped sample pack), TrueForge cleans them in a sandbox, and the portal opens a navigable dashboard. Default mode is **view**. Edit, personal dashboards, click-to-drill charts, and on-the-fly queries come next. Publishing the org Close dashboard is the human approval gate.

This repository is in **design**. Agent instructions and the living checklist live in [`AGENTS.md`](AGENTS.md) and [`docs/hackathon/STATUS.md`](docs/hackathon/STATUS.md). Application code is not on `main` yet.

## What judges should see

TrueForge does the work, not a chat wrapper:

- MCP tools against the close-pack cube
- Sandboxed ingest of CSV/Excel
- Subagents for P&L, cash, and growth
- Persistent sessions
- Pause for approval before publishing the org dashboard

## Run

Application runbook will land with the first vertical slice. Local TrueForge:

```bash
npx @truefoundry/trueforge
```

## Contributing

Substantive work goes through pull requests. Do not push application changes straight to `main`.

## Qodo Code Review Evidence

Qodo is required on every substantive PR. This section will link a representative merged PR once the first review trail exists.

- Representative PR: _pending first reviewed merge_
- What Qodo surfaced: _pending_
- What we changed or dismissed: _pending_
