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

Copy `.env.example` to `.env.local` if you need to override `DATABASE_URL`. Default is `postgres://$USER@127.0.0.1:5432/donecorner`. Production is one Vercel project on `main` (Neon Postgres + `AUTH_SECRET` / `AUTH_CFO_PASSWORD` / `OPENAI_API_KEY` in Vercel env, never `NEXT_PUBLIC_`). Then click **Load sample pack** — with TrueForge up, the rail pauses on `load_lake` before it truncates warehouse facts. After approval, Postgres holds ~10k fact rows and `data/lake/raw/northstar-group/facts.csv` is written.

Demo identity header (optional): `x-demo-user: cfo | fpna | viewer`. Default is `cfo`.

### TrueForge

```bash
npx @truefoundry/trueforge
```

Default URL locally: `http://localhost:8790`. On Vercel the portal boots TrueForge in-process. Override with `TRUEFORGE_BASE_URL` only when the harness is elsewhere.

Uploads require the sandbox:

```bash
TRUEFORGE_SANDBOX=1 npm run dev
```

Sample pack **lake replace** needs TrueForge: `load_lake` is approval-gated. Persist the query session id in `localStorage` key `donecorner.tf.session`.

MCP tools: HTTP JSON-RPC at `/api/mcp` (TrueForge remote server `donecorner`). The portal registers that server and the `close-pack` agent when TrueForge is up. Also `mcp/server.ts` stdio for local debugging. Tools: `load_sample_pack`, `load_lake` (approval required), `upload_close_file`, `inspect_file`, `get_mapping_proposal`, `apply_mapping` (approval required), `describe_schema`, `query_cube`, `query_lake`, `query_sql` (read-only Postgres), `present_chart`, `lookup_public_company`, `fetch_public_url` (Wikipedia + SEC allowlist), `list_dashboard_primitives`, `validate_dashboard`, `preview_dashboard`, `get_dashboard`, `save_personal_dashboard`, `request_publish_org` (approval required). Override the MCP URL with `DONECORNER_MCP_URL` if TrueForge cannot reach `http://127.0.0.1:$PORT/api/mcp`.

## Contributing

Substantive work goes through pull requests. Do not push application changes straight to `main`.

## Qodo Code Review Evidence

Qodo is required on every substantive PR.

- Representative PRs: https://github.com/ss-pratapIIITB/DoneCornerAI/pull/5 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/6 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/7 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/8 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/9 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/11 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/12 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/13 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/14 · https://github.com/ss-pratapIIITB/DoneCornerAI/pull/17
- What Qodo surfaced: cube metric bugs (PR 5/6); ingest bugs (quoted CSV, USD relabel, non-atomic replace, Excel zero-rows, empty uploads keeping stale data, non-numeric amounts stored as zero); lake/workspace Highs on PRs 11–13; PR 14: stale TrueForge health skipping HTTP seed, concurrent sample-pack turns, prompt-version bind staying on the first guidance, immutable policy sent as user content, and `load_lake` truncating without an approval-tool outcome; PR 17: 24k public-fetch truncation breaking SEC JSON, redirect SSRF off the Wikipedia/SEC allowlist, request-host MCP poisoning, and unscoped portal reset wiping other users and org Close
- What we changed or dismissed: cube fixes in PR 6. Ingest parser, USD skip, transactional replace, and Excel 4xx in PR 7. Empty recognized uploads now clear prior `source=upload` rows; malformed numbers reject the file. Host child-process sandbox kept (sample pack must run without Daytona). Personal drafts auto-save; org publish stays approval-gated. PR 9: HTTP MCP + Operate shell. Follow-up: default model `openai/gpt-5-4-mini`; `request_publish_org` queues pending only (does not self-approve). PR 14: policy lives on the agent spec; `load_lake` requires a current TrueForge approval; HTTP `confirm: true` no longer truncates the warehouse. PR 17: JSON/public fetch uses a larger complete-document cap and hop-checked redirects; MCP origin is loopback/`DONECORNER_PUBLIC_HOST` only; Reset is transactional and scoped to the editor. Dismissed requiring TrueForge approval for the human Reset button (it is not an MCP tool) and treating demo `x-demo-user` as OAuth — missing/spoofed identities already 403 on that route
