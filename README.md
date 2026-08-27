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

Default URL: `http://localhost:8790`. Override with `TRUEFORGE_BASE_URL`. Optional `TRUEFORGE_TOKEN` (OIDC). Optional `TRUEFORGE_MODEL` (default `anthropic/claude-sonnet-4-6` — the provider must exist in TrueForge or the query bar 422s).

Uploads require the sandbox:

```bash
TRUEFORGE_SANDBOX=1 npm run dev
```

Sample pack load works without Daytona or TrueForge. Persist the query session id in `localStorage` key `donecorner.tf.session`.

MCP tools: HTTP JSON-RPC at `/api/mcp` (TrueForge remote server `donecorner`). The portal registers that server and the `close-pack` agent when TrueForge is up. Also `mcp/server.ts` stdio for local debugging. Tools: `load_sample_pack`, `upload_close_file`, `describe_schema`, `query_cube`, `get_dashboard`, `save_personal_dashboard`, `request_publish_org` (approval required). Override the MCP URL with `DONECORNER_MCP_URL` if TrueForge cannot reach `http://localhost:3000/api/mcp`.

## Contributing

Substantive work goes through pull requests. Do not push application changes straight to `main`.

## Qodo Code Review Evidence

Qodo is required on every substantive PR.

- Representative PRs: https://github.com/ss-pratapIIITB/DoneCornerAI/pull/5 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/6 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/7
- What Qodo surfaced: cube metric bugs (PR 5/6); ingest bugs (quoted CSV, USD relabel, non-atomic replace, Excel zero-rows, empty uploads keeping stale data, non-numeric amounts stored as zero)
- What we changed or dismissed: cube fixes in PR 6. Ingest parser, USD skip, transactional replace, and Excel 4xx in PR 7. Empty recognized uploads now clear prior `source=upload` rows; malformed numbers reject the file. Host child-process sandbox kept (sample pack must run without Daytona). Publish approval stays the only human gate.
