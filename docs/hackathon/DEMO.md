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

Register the `donecorner` MCP server (stdio JSON-RPC in `mcp/server.ts`) and the `close-pack` agent (`agents/close-pack.json`) in TrueForge if the query bar should call tools. Sample pack load does **not** need TrueForge.

## Script

1. Open the portal. It is in **View**. No drag handles. Query bar is disabled if TrueForge is down; the cube still works.
2. Click **Load sample pack**. A revenue chart appears.
3. Click a period (or a drill key). Grain steps to **function**. Click **Up**.
4. Open **Schema**. Switch to **Edit** (auto-forks a personal board). Add **revenue as KPI**. Return to Close and write a note.
5. Ask: “Why is S&M over budget?” The agent rail shows **Running**, then an explanation. Optional chart/widget on the personal board.
6. Click **Publish to org**. Rail shows **Waiting for approval** with the overwrite payload. **Approve publish** — org Close updates. **Deny** leaves the personal draft.

That is the whole job: files in, cube out, drill without an LLM, follow-up via TrueForge, human gate on org publish.
