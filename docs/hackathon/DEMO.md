# 3-minute demo

Hackathon close: **Sun 30 Aug 2026, 20:00 London**.

Portal: `http://localhost:3000` (this app). TrueForge: `http://localhost:8790`.

## Before you record

```bash
npm install
createdb donecorner                 # or docker compose up -d postgres
npm run test
npm run test:e2e
npx @truefoundry/trueforge          # other terminal
TRUEFORGE_SANDBOX=1 npm run dev     # if you will drop a CSV
```

In the TrueForge UI, add an OpenAI (or other) provider. The portal defaults to `TRUEFORGE_MODEL=openai/gpt-5-4-mini`. Override the env if you registered a different name. Query follow-ups 422 until a provider exists; the cube still works.

Register is automatic: when TrueForge is up, the portal creates the `donecorner` remote MCP (`http://localhost:3000/api/mcp`) and the `close-pack` agent. Sample pack load does **not** need TrueForge.

## Script

1. Open the portal. It is in **View**. Query bar is disabled if TrueForge is down; the lake still works.
2. Click **Load sample pack**. Postgres fills with Northstar Group facts. A revenue chart and a P&amp;L table appear. The agent rail shows the load result.
3. Click a period (or a drill key). Grain steps to **group**, then vertical → company → category → product. Click **Up**. Click a P&amp;L cell to drill that period and account. Full screen / resize / Export CSV or PNG on each widget.
4. Ask: “Why is S&amp;M over budget?” The rail shows the full answer. If the agent calls `present_chart`, pin the graph to this board or a new one.
5. Open **Schema**. Switch to **Edit** (auto-forks a personal board). Add **revenue as KPI**. Return to Close and write a note.
6. Click **Publish to org**. Rail shows **Waiting for approval**. **Approve publish** — org Close updates. **Deny** leaves the personal draft.

That is the whole job: lake in, charts out, drill without an LLM, SQL via MCP, follow-up via TrueForge, human gate on org publish.
