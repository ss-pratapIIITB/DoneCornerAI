# DoneCornerAI Close Pack Portal — Design

Date: 2026-08-26  
Repo: [ss-pratapIIITB/DoneCornerAI](https://github.com/ss-pratapIIITB/DoneCornerAI)  
Status: approved  
Hackathon: Agent Harness Hackathon, due 30 Aug 2026 20:00 London

## 1. One job

A CFO drops a close pack (or loads the shipped sample). TrueForge cleans it in a sandbox, writes a cube, and drafts the org Close dashboard. The portal opens in **view**. The CFO drills by clicking charts, asks follow-up questions, forks a personal board, and **publishes to org** only after a human approval.

That is the 3-minute demo. Custom dashboards, schema explorer, and annotations exist to serve that job, not as a second product.

## 2. Who it is for

Demo identities only (no SSO in v1): **CFO**, **FP&A**, **viewer**.

| Role | View org Close | Fork / edit personal | Publish to org |
|---|---|---|---|
| CFO | yes | yes | yes (approval) |
| FP&A | yes | yes | yes (approval) |
| viewer | yes | no | no |

## 3. Architecture

Next.js App Router is the portal. TrueForge (local `npx @truefoundry/trueforge`) is the agent runtime via `@truefoundry/trueforge-core`. A local MCP server `donecorner` talks to SQLite.

```
Browser (view/edit, charts, query bar, agent rail)
    │
    ├─ cube query / dashboard CRUD  → Next.js route handlers → SQLite
    └─ follow-up questions          → TrueForge session (persistent)
                                          │
                                          ├─ MCP donecorner (files, cube, dashboards, publish)
                                          ├─ sandbox (CSV/XLSX → facts)
                                          └─ subagents: P&L, Cash, Growth
```

Click-to-drill does **not** call the model. It hits `query_cube` with updated filters and grain.

Publish is a TrueForge **approval** tool, not a UI-only confirm.

Session id is stored in the browser and reused on refresh.

## 4. Stack

- UI: Next.js (App Router), TypeScript, Impeccable Operate mode
- Cube / app DB: SQLite
- Agent: TrueForge HTTP API + TypeScript SDK
- Tools: MCP server in-repo
- Ingest: Daytona sandbox when configured; if sandbox is missing locally, ingest of the **sample pack** can be a deterministic loader so judges still run. Uploaded files require the sandbox.
- Charts: one library (Recharts or ECharts) — pick at plan time, one only

## 5. Data

Fictional company **Northstar**. Generate the close pack ourselves. Public CSVs are reference only unless they pass: monthly grain, ≥12 months, function mapping, actual+budget, cash that can roll, ARR waterfall that ties to revenue, no PII, permissive license.

### Fact tables

`facts_pnl` grain: `period + entity + function + account`  
Columns: period (YYYY-MM), entity, function (`cogs|sm|rd|ga|other`), account, account_type (`pnl`), amount, currency (`USD`), scenario (`actual|budget|forecast`)

`facts_cash` grain: `period + entity`  
Columns: period, entity, cash_in, cash_out, ending_balance, scenario

`facts_arr` grain: `period + entity`  
Columns: period, entity, beginning_arr, new, expansion, contraction, churn, ending_arr

`facts_headcount` grain: `period + entity + function`  
Columns: period, entity, function, fte, scenario

### Derived metrics (computed in cube, not stored as facts)

P&L: revenue, COGS, gross profit, gross margin %, OpEx by function, EBITDA, OpEx ratio  
Cash: net burn, runway months, burn vs budget  
Plan: budget vs actual $ and %  
Growth: ARR, MRR (= ARR/12), net new ARR, NRR, GRR, waterfall  
Efficiency: Rule of 40, burn multiple, magic number, CAC payback, LTV:CAC, revenue per FTE, headcount vs plan

Formulas are listed in `docs/metrics.md` at implementation time (one source of truth). If a metric cannot be derived from the four tables, it is omitted rather than faked.

### Files

Shipped pack: `data/northstar/` as CSV (pnl, cash, arr, headcount, budget).  
Uploads: CSV or Excel, cleaned in sandbox into the same fact shape, tagged `source=upload`.

## 6. Agent and MCP

One saved TrueForge agent: **Close Pack**.

Skills (git-backed `SKILL.md` in-repo): ingest/clean, cube metrics, dashboard author, insight narrative.

MCP tools:

| Tool | Does |
|---|---|
| `load_sample_pack` | Load Northstar CSVs into SQLite |
| `upload_close_file` | Store file, ask sandbox to normalize |
| `describe_schema` | Tables, columns, grains, metric defs |
| `query_cube` | metric, grain, filters → rows |
| `get_dashboard` | org or personal layout JSON |
| `save_personal_dashboard` | Write personal layout (no approval) |
| `request_publish_org` | Replace org Close; **requires approval** |

Subagents (parallel after ingest): P&L, Cash, Growth. Each returns KPIs + widget specs. Parent composes the Close draft onto the **personal** fork first; org is unchanged until publish is approved.

Query bar = a new turn on the same session, with current dashboard filters in context. The agent may call `query_cube` or, only if the cube cannot answer, the sandbox. It may add a widget to the personal board via `save_personal_dashboard`.

## 7. Portal UX

**Layout A.** Left rail: Close, My boards, Schema. Top: **View | Edit** then query field. Center: dashboard. Right rail: agent (running / waiting for approval / done).

Opens in **View**.

**Mode A (same board, mode bar).** View: drill, filter, query, read annotations. No drag handles. Edit: amber strip, drag widgets, add from schema, Fork if on org board, Publish to org. Org Close cannot be mutated in edit; Edit on org auto-forks to personal.

**Schema.** Left-rail page. Lists tables, column types, grain, metric definitions. In Edit, a metric can be dropped onto the personal board as a KPI/bar/line/table. In View, schema is read-only.

**Annotations.** Widget notes. Visible in view. Created/edited on personal boards in edit. Org annotations only change via publish.

**Charts.** Click a bar: add that member to filters, step grain period → function → account. Breadcrumbs drill up. Entity/region is a filter chip, not a drill level.

**Empty state.** No cube yet: Load sample pack, or drop files (sandbox).

**Approval UI.** Right rail shows the pending publish payload (what will overwrite org Close). Approve / deny. Deny leaves personal draft intact.

## 8. Errors

| Case | Behavior |
|---|---|
| Bad/unreadable upload | Agent reports; cube unchanged |
| Sandbox fail | Retry once, then stop with the error in the rail |
| Cube query empty | Empty widget, not a crash |
| Publish denied | Org unchanged; personal kept |
| Publish approved, write fail | Org unchanged; surface error; retry allowed |
| TrueForge down | Portal still shows last cube/dashboard; query bar disabled with reason |
| Viewer hits Edit/Publish | Control hidden; API 403 |

Secrets never in git or the demo video.

## 9. Testing

- Cube metrics and drill grain: unit tests with Northstar fixtures
- MCP tool contracts: golden request/response
- Publish state machine: pending / approved / denied
- Playwright: view is default; click bar drills; query adds a widget; publish pauses; refresh restores session
- No product claim of “done” without those commands passing

## 10. Demo (≈3 minutes)

1. Open portal — **view**, empty or previous Close.  
2. Load sample pack — agent + sandbox (or deterministic sample load, then a second uploaded CSV through sandbox).  
3. Subagents fill the Close draft.  
4. Click a month bar → functions; click S&M → accounts. Breadcrumb back.  
5. Query: “Why is S&M over budget?” — explanation + optional chart.  
6. Edit personal fork, then Publish — **approval pause**, then org updates.

## 11. Out of scope for this spec

SSO, multi-currency beyond USD, live warehouse, write-back to GL, real company data, mobile-native app, TrueForge hosted/Postgres mode, winning more than one prize track (rules allow only one win).

## 12. Hackathon mapping

| Track | Where it shows |
|---|---|
| Double-O | MCP, sandbox ingest, subagents, persistent session, publish approval |
| Q Branch | PR + Qodo trail, README evidence |
| Savile Row | View default, agent rail, approval before org overwrite |
| Field Report / Radio | Built after the slice runs |

## 13. Recommended defaults (user: take these unless we stop)

- Layout A (nav + board)
- View/Edit: same board, mode bar
- Generate Northstar pack; do not ship random public CSVs as-is
- Click-to-drill skips the LLM
- Personal edit free; org publish gated
