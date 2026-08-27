# DoneCornerAI

CFO **close-pack** portal for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (24–30 August 2026).

Drop P&L / cash / budget files (or load the shipped **Northstar** lake pack). The portal opens a navigable dashboard. Default mode is **view**. Click charts to drill Period → Group → Vertical → Company → Category → Product. Org Close publish is the human approval gate.

Instructions: [`AGENTS.md`](AGENTS.md). Checklist: [`docs/hackathon/STATUS.md`](docs/hackathon/STATUS.md). Formulas: [`docs/metrics.md`](docs/metrics.md). Demo script: [`docs/hackathon/DEMO.md`](docs/hackathon/DEMO.md). Field report: [`docs/hackathon/FIELD-REPORT.md`](docs/hackathon/FIELD-REPORT.md).

## Run

Requires Node 22+ (Node 24 recommended; `node:sqlite` is used).

```bash
npm install
createdb donecorner   # or: docker compose up -d postgres
npx playwright install chromium   # once, for e2e
npm run test                      # vitest
npm run test:e2e                  # playwright
npm run dev                       # http://localhost:3000
```

Copy `.env.example` to `.env.local` if you need to override `DATABASE_URL`. Default is `postgres://$USER@127.0.0.1:5432/donecorner`. Then click **Load sample pack** — that seeds ~10k fact rows into Postgres and writes `data/lake/raw/northstar-group/facts.csv`.

Demo identity header (optional): `x-demo-user: cfo | fpna | viewer`. Default is `cfo`.

### TrueForge

```bash
npx @truefoundry/trueforge
```

Default URL: `http://localhost:8790`. Override with `TRUEFORGE_BASE_URL`. Optional `TRUEFORGE_TOKEN` (OIDC). Optional `TRUEFORGE_MODEL` (default `openai/gpt-5-4-mini`, the cheapest OpenAI model TrueForge lists once an OpenAI key is added).

Uploads require the sandbox:

```bash
TRUEFORGE_SANDBOX=1 npm run dev
```

Sample pack load works without Daytona or TrueForge. Persist the query session id in `localStorage` key `donecorner.tf.session`.

MCP tools: HTTP JSON-RPC at `/api/mcp` (TrueForge remote server `donecorner`). The portal registers that server and the `close-pack` agent when TrueForge is up. Also `mcp/server.ts` stdio for local debugging. Tools: `load_sample_pack`, `load_lake`, `upload_close_file`, `describe_schema`, `query_cube`, `query_lake`, `query_sql` (read-only Postgres), `present_chart`, `get_dashboard`, `save_personal_dashboard`, `request_publish_org` (approval required). Override the MCP URL with `DONECORNER_MCP_URL` if TrueForge cannot reach `http://127.0.0.1:$PORT/api/mcp`.

## Contributing

Substantive work goes through pull requests. Do not push application changes straight to `main`.

## Qodo Code Review Evidence

Qodo is required on every substantive PR.

- Representative PRs: https://github.com/ss-pratapIIITB/DoneCornerAI/pull/5 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/6 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/7 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/8 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/9
- What Qodo surfaced: cube metric bugs (PR 5/6); ingest bugs (quoted CSV, USD relabel, non-atomic replace, Excel zero-rows, empty uploads keeping stale data, non-numeric amounts stored as zero)
- What we changed or dismissed: cube fixes in PR 6. Ingest parser, USD skip, transactional replace, and Excel 4xx in PR 7. Empty recognized uploads now clear prior `source=upload` rows; malformed numbers reject the file. Host child-process sandbox kept (sample pack must run without Daytona). Publish approval stays the only human gate. PR 9: HTTP MCP + Operate shell. Follow-up: default model `openai/gpt-5-4-mini`; `request_publish_org` queues pending only (does not self-approve).
