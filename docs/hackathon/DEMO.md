# 3-minute demo

Hackathon close: **Sun 30 Aug 2026, 20:00 London**.

Portal: `http://localhost:3000` (this app). TrueForge: `http://localhost:8790`.

## Before you record

```bash
npm install
npm run test
npm run test:e2e
npx @truefoundry/trueforge          # other terminal
TRUEFORGE_SANDBOX=1 npm run dev     # if you will drop a CSV
```

In the TrueForge UI, add an OpenAI (or other) provider. The portal defaults to `TRUEFORGE_MODEL=openai/gpt-5-4-mini`. Override the env if you registered a different name. Query follow-ups 422 until a provider exists; the cube still works.

Register is automatic: when TrueForge is up, the portal creates the `donecorner` remote MCP (`http://localhost:3000/api/mcp`) and the `close-pack` agent. Sample pack load does **not** need TrueForge.

## Script

1. Open the portal. It is in **View**. No drag handles. Query bar is disabled if TrueForge is down; the cube still works.
2. Click **Load sample pack**. A revenue chart appears. The agent rail shows P&L, Cash, and Growth slices finished.
3. Click a period (or a drill key). Grain steps to **function**. Click **Up**. Optional: drop a `facts_pnl.csv` with `TRUEFORGE_SANDBOX=1` — a child-process cleaner loads `source=upload` rows.
4. Open **Schema**. Switch to **Edit** (auto-forks a personal board). Add **revenue as KPI**. Return to Close and write a note.
5. Ask: “Why is S&M over budget?” The agent rail shows **Running**, then an explanation. Optional chart/widget on the personal board.
6. Click **Publish to org**. Rail shows **Waiting for approval** with the overwrite payload. **Approve publish** — org Close updates. **Deny** leaves the personal draft.

That is the whole job: files in, cube out, drill without an LLM, follow-up via TrueForge, human gate on org publish.
