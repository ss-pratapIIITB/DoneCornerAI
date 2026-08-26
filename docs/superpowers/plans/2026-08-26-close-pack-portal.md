# Close Pack Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Next.js CFO portal that loads the Northstar close pack, opens in view mode, drills charts without an LLM, queries TrueForge on the fly, and publishes the org Close dashboard only after a human approval.

**Architecture:** Next.js App Router owns view/edit, cube queries, and dashboards. SQLite holds facts and layouts. TrueForge (`@truefoundry/trueforge-sdk`) owns ingest narration, subagents, and the publish approval. Click-to-drill calls `queryCube` directly.

**Tech Stack:** Next.js App Router, TypeScript, Tailwind, Vitest, Playwright, better-sqlite3, Recharts, `@truefoundry/trueforge-sdk`, in-repo MCP (`@modelcontextprotocol/sdk`).

## Global Constraints

- Public repo [ss-pratapIIITB/DoneCornerAI](https://github.com/ss-pratapIIITB/DoneCornerAI). Author commits as Surendra Pratap `<surendrapratap0501@gmail.com>` via env vars; do not change git config.
- Spec: `docs/superpowers/specs/2026-08-26-close-pack-portal-design.md` — follow it; do not expand scope.
- Portal opens in **view**. Edit on org Close auto-forks to personal. Org overwrite only via `request_publish_org` approval.
- Click-to-drill does not call the model. Uploads require sandbox; `load_sample_pack` is deterministic without sandbox.
- Currency USD only. Demo users: `cfo`, `fpna`, `viewer`. Chart library is **Recharts** (only).
- TrueForge SDK package is `@truefoundry/trueforge-sdk` (not `trueforge-core`). Local server `http://localhost:8790`.
- Secrets stay out of git. SQLite files are gitignored. Substantive work on a branch, never commit straight to `main`.
- TDD for cube, dashboards, identity, MCP. Impeccable Operate for UI. Verify tests before claiming done.

---

## File map

| Path | Responsibility |
|---|---|
| `app/layout.tsx` | App shell |
| `app/page.tsx` | Close dashboard (default view) |
| `app/boards/page.tsx` | Personal boards |
| `app/schema/page.tsx` | Schema explorer |
| `app/globals.css` | Tokens |
| `app/api/cube/route.ts` | POST query |
| `app/api/dashboards/route.ts` | GET/PUT personal + org |
| `app/api/dashboards/publish/route.ts` | Execute approved publish |
| `app/api/pack/load/route.ts` | Load sample pack |
| `app/api/session/route.ts` | TrueForge session create/resume |
| `app/api/session/turn/route.ts` | Stream a turn |
| `app/api/session/approve/route.ts` | Submit approval |
| `lib/db/sqlite.ts` | Connection |
| `lib/db/migrate.ts` | Schema |
| `lib/cube/types.ts` | Shared types |
| `lib/cube/metrics.ts` | Derived metrics |
| `lib/cube/query.ts` | `queryCube` |
| `lib/cube/drill.ts` | Grain step / breadcrumbs |
| `lib/cube/schema.ts` | `describeSchema` |
| `lib/pack/load-sample.ts` | CSV → SQLite |
| `lib/pack/parse-upload.ts` | Sandbox contract types |
| `lib/dashboards/store.ts` | Layout CRUD |
| `lib/dashboards/publish.ts` | pending / approved / denied |
| `lib/identity/demo-users.ts` | Roles |
| `lib/trueforge/client.ts` | SDK wrapper |
| `lib/trueforge/session.ts` | Cookie/session id |
| `components/shell/AppShell.tsx` | Layout A |
| `components/shell/ModeBar.tsx` | View \| Edit |
| `components/shell/QueryBar.tsx` | Query |
| `components/shell/AgentRail.tsx` | running / waiting / done |
| `components/dashboard/DashboardCanvas.tsx` | Widgets |
| `components/dashboard/NavigableChart.tsx` | Click-to-drill |
| `components/dashboard/KpiCard.tsx` | KPI |
| `mcp/server.ts` | MCP stdio/http |
| `mcp/tools.ts` | Tool handlers |
| `skills/*/SKILL.md` | TrueForge skills |
| `data/northstar/*.csv` | Sample pack |
| `docs/metrics.md` | Formula source of truth |
| `tests/unit/*.test.ts` | Vitest |
| `tests/e2e/*.spec.ts` | Playwright |

---

### Task 1: Scaffold Next.js + Vitest

**Files:**
- Create: Next.js app at repo root (do not delete `AGENTS.md`, `docs/`, `README.md`)
- Create: `vitest.config.ts`, `tests/unit/health.test.ts`
- Modify: `package.json` scripts `test`, `test:e2e`
- Modify: `.gitignore` keep existing secrets/sqlite ignores

**Interfaces:**
- Consumes: existing repo files
- Produces: `npm test` runs Vitest; `npm run dev` starts Next

- [ ] **Step 1: Scaffold**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-npm --turbopack --yes
```

If the CLI refuses a non-empty dir, init `package.json` by hand with `next@latest`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@tailwindcss/postcss`. Keep `README.md` and `AGENTS.md`.

- [ ] **Step 2: Add Vitest**

```bash
npm i -D vitest @vitejs/plugin-react jsdom
```

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["tests/unit/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
});
```

- [ ] **Step 3: Failing health test**

```ts
// tests/unit/health.test.ts
import { describe, it, expect } from "vitest";
import { appName } from "@/lib/identity/demo-users";

describe("scaffold", () => {
  it("exports app name", () => {
    expect(appName).toBe("DoneCornerAI");
  });
});
```

Run: `npx vitest run tests/unit/health.test.ts`  
Expected: FAIL cannot find module

- [ ] **Step 4: Minimal impl**

```ts
// lib/identity/demo-users.ts
export const appName = "DoneCornerAI";
```

Run: `npx vitest run tests/unit/health.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json app lib tests vitest.config.ts tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs
git commit -m "Scaffold Next.js app with Vitest."
```

---

### Task 2: Metric formulas

**Files:**
- Create: `docs/metrics.md`, `lib/cube/types.ts`, `lib/cube/metrics.ts`
- Test: `tests/unit/metrics.test.ts`

**Interfaces:**
- Consumes: none
- Produces:

```ts
export type FunctionCode = "cogs" | "sm" | "rd" | "ga" | "other";
export type Scenario = "actual" | "budget" | "forecast";
export type Grain = "period" | "function" | "account";
export type MetricId =
  | "revenue" | "cogs" | "gross_profit" | "gross_margin_pct"
  | "opex" | "ebitda" | "opex_ratio" | "net_burn" | "runway_months"
  | "burn_vs_budget" | "bva_amount" | "bva_pct" | "arr" | "mrr"
  | "net_new_arr" | "nrr" | "grr" | "rule_of_40" | "burn_multiple"
  | "magic_number" | "rev_per_fte";

export function grossMarginPct(revenue: number, cogs: number): number | null;
export function netBurn(cashIn: number, cashOut: number): number;
export function runwayMonths(endingBalance: number, avgMonthlyBurn: number): number | null;
export function mrrFromArr(arr: number): number;
export function nrr(beginningArr: number, expansion: number, contraction: number, churn: number): number | null;
export function grr(beginningArr: number, contraction: number, churn: number): number | null;
export function ruleOf40(arrGrowthPct: number, ebitdaMarginPct: number): number;
```

Omit CAC payback and LTV:CAC unless `facts_arr.new` and S&M spend both exist for the period (then `cacPaybackMonths = smSpend / (newArr / 12)`). If either is missing, do not fake the metric.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { grossMarginPct, mrrFromArr, nrr, runwayMonths } from "@/lib/cube/metrics";

describe("metrics", () => {
  it("computes gross margin", () => {
    expect(grossMarginPct(100, 20)).toBe(80);
  });
  it("returns null margin when revenue is 0", () => {
    expect(grossMarginPct(0, 10)).toBeNull();
  });
  it("converts ARR to MRR", () => {
    expect(mrrFromArr(1200)).toBe(100);
  });
  it("computes NRR", () => {
    expect(nrr(100, 20, 5, 5)).toBe(110);
  });
  it("returns null runway when not burning", () => {
    expect(runwayMonths(500, 0)).toBeNull();
  });
});
```

Run: `npx vitest run tests/unit/metrics.test.ts`  
Expected: FAIL module not found

- [ ] **Step 2: Implement `lib/cube/metrics.ts` to match tests and `docs/metrics.md`**

- [ ] **Step 3: Tests pass, commit** `docs(metrics): add cube formula module`

---

### Task 3: Northstar CSVs + load_sample_pack

**Files:**
- Create: `data/northstar/facts_pnl.csv`, `facts_cash.csv`, `facts_arr.csv`, `facts_headcount.csv`
- Create: `lib/db/sqlite.ts`, `lib/db/migrate.ts`, `lib/pack/load-sample.ts`
- Test: `tests/unit/load-sample.test.ts`

**Interfaces:**
- Produces: `getDb(): Database`, `migrate(db)`, `loadSamplePack(db): { periods: number }`
- DB path: `process.env.DONECORNER_DB ?? ".data/donecorner.sqlite"` (directory created on demand)
- 12 periods `2025-01` … `2025-12`, entity `northstar`, USD
- P&L functions map to `cogs|sm|rd|ga`. ARR waterfall ties: `ending = beginning + new + expansion - contraction - churn`. Cash `ending_balance` rolls.

- [ ] **Step 1: Failing test** — after load, `SELECT count(DISTINCT period) FROM facts_pnl` is 12 and ARR roll-forward holds for each month

- [ ] **Step 2: Implement schema**

```sql
CREATE TABLE IF NOT EXISTS facts_pnl (
  period TEXT, entity TEXT, function TEXT, account TEXT,
  amount REAL, currency TEXT, scenario TEXT, source TEXT
);
CREATE TABLE IF NOT EXISTS facts_cash (
  period TEXT, entity TEXT, cash_in REAL, cash_out REAL,
  ending_balance REAL, scenario TEXT, source TEXT
);
CREATE TABLE IF NOT EXISTS facts_arr (
  period TEXT, entity TEXT, beginning_arr REAL, new REAL, expansion REAL,
  contraction REAL, churn REAL, ending_arr REAL, source TEXT
);
CREATE TABLE IF NOT EXISTS facts_headcount (
  period TEXT, entity TEXT, function TEXT, fte REAL, scenario TEXT, source TEXT
);
```

- [ ] **Step 3: Tests pass, commit** `feat: load Northstar sample pack into SQLite`

---

### Task 4: queryCube + drill

**Files:**
- Create: `lib/cube/query.ts`, `lib/cube/drill.ts`
- Test: `tests/unit/query-cube.test.ts`, `tests/unit/drill.test.ts`

**Interfaces:**

```ts
export type CubeFilters = {
  period?: string[];
  function?: FunctionCode[];
  account?: string[];
  entity?: string[];
  scenario?: Scenario;
};

export type CubeQuery = {
  metric: MetricId;
  grain: Grain;
  filters: CubeFilters;
};

export type CubeRow = { key: string; label: string; value: number };

export function queryCube(db: Database, q: CubeQuery): CubeRow[];

export function nextGrain(grain: Grain): Grain | null; // period→function→account→null
export function prevGrain(grain: Grain): Grain | null;
export function drillDown(q: CubeQuery, clickedKey: string): CubeQuery;
export function drillUp(q: CubeQuery): CubeQuery;
```

`drillDown` copies `q`, sets `filters[grain] = [clickedKey]`, sets `grain = nextGrain(grain)`. If `nextGrain` is null, return `q` unchanged.

- [ ] **Step 1: Tests** — revenue by period has 12 rows; drillDown on `2025-06` yields function grain with `filters.period = ["2025-06"]`; drillUp restores period grain

- [ ] **Step 2: Implement, pass, commit** `feat: cube query and click-to-drill grain`

---

### Task 5: Dashboards + publish state machine

**Files:**
- Create: `lib/dashboards/store.ts`, `lib/dashboards/publish.ts`, `lib/cube/schema.ts`
- Test: `tests/unit/dashboards.test.ts`, `tests/unit/publish.test.ts`

**Interfaces:**

```ts
export type WidgetType = "kpi" | "bar" | "line" | "table";
export type Widget = {
  id: string;
  type: WidgetType;
  title: string;
  query: CubeQuery;
  note: string;
};
export type Dashboard = {
  id: string;
  name: string;
  owner: "org" | string; // user id
  forkedFrom: string | null;
  widgets: Widget[];
};

export function getDashboard(db: Database, id: string): Dashboard | null;
export function savePersonalDashboard(db: Database, userId: string, d: Dashboard): Dashboard;
export function forkOrgToPersonal(db: Database, userId: string): Dashboard;
export function describeSchema(): { tables: unknown[]; metrics: { id: MetricId; grain: Grain; description: string }[] };

export type PublishState = "pending" | "approved" | "denied";
export function requestPublishOrg(db: Database, userId: string, personalId: string): { id: string; state: "pending" };
export function resolvePublish(db: Database, id: string, decision: "approved" | "denied"): { state: PublishState };
```

Approved copies personal widgets onto the org Close dashboard (`id = "org-close"`). Denied leaves org unchanged.

Viewer cannot save or publish — throw `{ code: "FORBIDDEN" }`.

- [ ] **Step 1: Tests** for fork, deny (org unchanged), approve (org matches personal), viewer forbidden

- [ ] **Step 2: Implement, pass, commit** `feat: personal dashboards and publish approval state`

---

### Task 6: Identity + API routes

**Files:**
- Modify: `lib/identity/demo-users.ts`
- Create: API routes listed in file map
- Test: `tests/unit/identity.test.ts` plus route tests with `vite-node` or Next request helpers

**Interfaces:**

```ts
export type DemoUserId = "cfo" | "fpna" | "viewer";
export function parseDemoUser(header: string | null): { id: DemoUserId; canEdit: boolean; canPublish: boolean };
```

Header: `x-demo-user`. Default `cfo`. Viewer: `canEdit=false`, `canPublish=false`.

`POST /api/cube` body `CubeQuery` → `{ rows: CubeRow[] }`  
`POST /api/pack/load` → `{ periods: number }`  
`GET /api/dashboards?id=`  
`PUT /api/dashboards` personal only  
`POST /api/dashboards/publish` `{ action: "request" | "resolve", id?, decision? }`

- [ ] **Step 1: Tests for parseDemoUser and 403 on viewer PUT**

- [ ] **Step 2: Implement routes, pass, commit** `feat: demo identity and cube API routes`

---

### Task 7: Portal shell (Impeccable Operate)

**Files:** shell components + `app/page.tsx`, `app/layout.tsx`, `app/globals.css`

Default `mode=view`. Left: Close, My boards, Schema. Top: View | Edit, QueryBar. Center: canvas. Right: AgentRail.

Edit on org Close calls `forkOrgToPersonal` then stays in edit.

Empty cube: buttons Load sample pack / drop zone (drop zone wired in Task 10).

- [ ] **Step 1: Playwright** `tests/e2e/view-default.spec.ts` — open `/`, expect `data-mode="view"`, no drag handles (`data-draggable` absent)

- [ ] **Step 2: Implement shell until Playwright passes**

- [ ] **Step 3: Commit** `feat: view-default portal shell`

Follow `.cursor/skills/impeccable/SKILL.md` Operate + craft-floor before visual styling. No purple-gradient AI aesthetic.

---

### Task 8: Navigable charts

**Files:** `components/dashboard/*`

Recharts bar/line. Click a bar → `drillDown`. Breadcrumb buttons → `drillUp`.

- [ ] **Step 1: Playwright** click first period bar, expect function grain label; click breadcrumb, expect period grain

- [ ] **Step 2: Implement, pass, commit** `feat: click-to-drill charts`

---

### Task 9: Schema page + annotations

**Files:** `app/schema/page.tsx`

View: read-only tables/metrics. Edit: add KPI/bar from a metric onto personal board. Widget notes editable in edit, visible in view.

- [ ] **Step 1: Unit test `describeSchema` includes `facts_pnl` and metric `revenue`**

- [ ] **Step 2: UI + commit** `feat: schema explorer and widget notes`

---

### Task 10: MCP + TrueForge session + approval UI

**Files:** `mcp/tools.ts`, `mcp/server.ts`, `lib/trueforge/*`, `app/api/session/*`, `skills/*/SKILL.md`

MCP tools wrap existing functions with the spec names: `load_sample_pack`, `upload_close_file`, `describe_schema`, `query_cube`, `get_dashboard`, `save_personal_dashboard`, `request_publish_org`.

`request_publish_org` is listed in the agent as `require_approval_for_tools`.

Agent name `close-pack`. Instructions: load pack or accept upload; run P&L/Cash/Growth analysis; draft personal Close widgets; never overwrite org without `request_publish_org`.

Client:

```ts
import { TrueForge } from "@truefoundry/trueforge-sdk";
export function trueforge(): TrueForge {
  return new TrueForge({
    baseUrl: process.env.TRUEFORGE_BASE_URL ?? "http://localhost:8790",
    timeoutInSeconds: 600,
  });
}
```

Persist `session.id` in `localStorage` key `donecorner.tf.session`. Refresh resumes that id; if 404, create a new session.

AgentRail states: `running` | `waiting_approval` | `done` | `error`. TrueForge down: disable QueryBar, show reason, still render last cube.

Upload: `upload_close_file` stores bytes, returns a sandbox instruction. If `process.env.TRUEFORGE_SANDBOX !== "1"`, reject upload with a clear error (sample pack still works).

- [ ] **Step 1: Unit tests for MCP tool wrappers (in-process, no network)**

- [ ] **Step 2: Playwright skip-if-no-trueforge for query + approval; always test AgentRail waiting UI with a fixture event**

- [ ] **Step 3: Commit** `feat: TrueForge session, MCP tools, publish approval rail`

---

### Task 11: README + demo script

**Files:** `README.md`, `docs/hackathon/DEMO.md`

Include: Node 22+, `npm install`, `npm test`, `npm run dev`, `npx @truefoundry/trueforge`, `TRUEFORGE_BASE_URL`, Qodo evidence stub, 3-minute demo steps from the spec.

- [ ] **Step 1: Write docs**

- [ ] **Step 2: Commit** `docs: runbook and demo script`

---

## Spec coverage

| Spec section | Task |
|---|---|
| One job / demo | 7–11 |
| Roles | 6 |
| Architecture | 1, 6, 10 |
| Northstar data | 3 |
| Metrics | 2 |
| Cube drill | 4, 8 |
| Dashboards / publish | 5 |
| Schema / notes | 9 |
| MCP / sandbox / session | 10 |
| View default / layout A | 7 |
| Errors | 5, 6, 10 |
| README / Qodo | 11 |

## Execution

Fast mode: execute inline with `executing-plans`. Open PRs for implementation on `feat/close-pack`, not `main`.
