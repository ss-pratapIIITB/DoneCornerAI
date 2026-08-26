# DoneCornerAI

CFO **close-pack** portal for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (24–30 August 2026).

Drop P&L / cash / budget files (or load the shipped **Northstar** sample pack). The portal opens a navigable dashboard. Default mode is **view**. Click charts to drill Period → Function → Account. Org Close publish is the human approval gate.

Instructions: [`AGENTS.md`](AGENTS.md). Checklist: [`docs/hackathon/STATUS.md`](docs/hackathon/STATUS.md). Formulas: [`docs/metrics.md`](docs/metrics.md).

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

Local TrueForge (query bar / ingest, when wired):

```bash
npx @truefoundry/trueforge
```

Default URL: `http://localhost:8790`.

## Contributing

Substantive work goes through pull requests. Do not push application changes straight to `main`.

## Qodo Code Review Evidence

Qodo is required on every substantive PR.

- Representative PR: https://github.com/ss-pratapIIITB/DoneCornerAI/pull/5
- What Qodo surfaced: _awaiting GitHub App on this repo_
- What we changed or dismissed: _pending_
