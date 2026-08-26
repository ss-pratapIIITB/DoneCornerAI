# DoneCornerAI

CFO **close-pack** portal for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (24–30 August 2026).

Drop P&L / cash / budget files (or load the shipped **Northstar** sample pack). The portal opens a navigable dashboard. Default mode is **view**. Click charts to drill Period → Function → Account. Org Close publish is the human approval gate.

Instructions: [`AGENTS.md`](AGENTS.md). Checklist: [`docs/hackathon/STATUS.md`](docs/hackathon/STATUS.md). Formulas: [`docs/metrics.md`](docs/metrics.md). Demo script: [`docs/hackathon/DEMO.md`](docs/hackathon/DEMO.md). Field report: [`docs/hackathon/FIELD-REPORT.md`](docs/hackathon/FIELD-REPORT.md).

## Run

Requires Node 22+ (Node 24 recommended; `node:sqlite` is used).

```bash
npm install
npx playwright install chromium   # once, for e2e
npm run test                      # vitest
npm run test:e2e                  # playwright
npm run dev                       # http://localhost:3000
```

Demo identity header (optional): `x-demo-user: cfo | fpna | viewer`. Default is `cfo`.

### TrueForge

```bash
npx @truefoundry/trueforge
```

Default URL: `http://localhost:8790`. Override with `TRUEFORGE_BASE_URL`. Optional `TRUEFORGE_TOKEN` (OIDC). Optional `TRUEFORGE_MODEL`.

Uploads require the sandbox:

```bash
TRUEFORGE_SANDBOX=1 npm run dev
```

Sample pack load works without Daytona or TrueForge. Persist the query session id in `localStorage` key `donecorner.tf.session`.

MCP tools (in-process, also `mcp/server.ts` stdio JSON-RPC): `load_sample_pack`, `upload_close_file`, `describe_schema`, `query_cube`, `get_dashboard`, `save_personal_dashboard`, `request_publish_org` (approval required).

## Contributing

Substantive work goes through pull requests. Do not push application changes straight to `main`.

## Qodo Code Review Evidence

Qodo is required on every substantive PR.

- Representative PR: https://github.com/ss-pratapIIITB/DoneCornerAI/pull/5 (findings) · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/6 (fixes)
- What Qodo surfaced: six cube bugs (ARR `scenario` column, gross margin as dollars, runway as burn, unimplemented metrics falling through to P&L sums, cash/ARR drill grains, non-transactional sample reload)
- What we changed or dismissed: all six addressed in PR 6 — table-aware filters, derived metrics, period-only cash/ARR grains, and a transactional sample load. Nothing dismissed.
