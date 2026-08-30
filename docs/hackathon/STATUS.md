# Living checklist

Update this file whenever a step starts or finishes. Do not skip.

Hackathon ends **Sun 30 Aug 2026, 20:00 London**. Today when this was created: **Wed 26 Aug 2026**.

## Now

**Phase:** 4 — Hackathon evidence

**Current step:** Hosted TrueForge on Vercel — OpenAI provider seed.

## Phase 1 — Brainstorm (`brainstorming`)

- [x] Explore project context (empty repo; hackathon brief; TrueForge docs)
- [x] Clarifying questions (one at a time) — core product locked; more only if a hole appears
- [x] 2–3 approaches with trade-offs + recommendation — portal + TrueForge SDK
- [x] Design sections — remaining UX took recommended defaults (layout A, same-board edit)
- [x] Spec written to `docs/superpowers/specs/2026-08-26-close-pack-portal-design.md`
- [x] Spec self-review (no TBD; one job; publish is the only approval)
- [x] User reviews spec

## Phase 2 — Plan (`writing-plans`)

- [x] Implementation plan in `docs/superpowers/plans/`
- [x] File map + bite-sized TDD tasks
- [x] User approves plan

## Phase 3 — Build (demo-first vertical slice)

- [x] TrueForge local harness + model + sandbox
- [x] Data plane (sample finance pack + MCP)
- [x] Agent: ingest → sandbox analysis → insights (subagents)
- [x] Portal shell: view default, edit toggle
- [x] Default dashboard + custom dashboards
- [x] Navigable charts (click filter, drill down/up)
- [x] On-the-fly query → explanation / chart
- [x] Approval gate on publish / sensitive export
- [x] Persistent session survives refresh
- [x] Impeccable Operate UI pass + browser verify
- [x] True lake (files + Postgres catalog) + MCP `query_sql` / `present_chart` (`feat/cfo-lake`)
- [x] Chart export, widget fullscreen/resize, pin agent chart to any board
- [x] Hierarchical drill including P&amp;L table cells
- [x] Signal Room redesign: exception-first layout, responsive agent bar, accessible fullscreen/resize, documented design system
- [x] Observable TrueForge run ledger + replay
- [x] Agent-owned quarantine, inspection, mapping approval, and canonical load
- [x] Unified Markdown agent workspace + attachments
- [x] Validated agent-designed dashboard DSL
- [x] Editable CFO guidance + read-only assembled prompt ([PR 14](https://github.com/ss-pratapIIITB/DoneCornerAI/pull/14))

## Phase 4 — Hackathon evidence

- [x] Qodo installed on the repo
- [ ] Every substantive change via PR; High findings fixed or dismissed with reason
- [x] README: runbook + `## Qodo Code Review Evidence`
- [x] ~3 min demo script (tool + sandbox + approval visible)
- [x] Field Report draft
- [ ] Radio Traffic posts (tag WeMakeDevs, TrueFoundry, Qodo)
- [ ] Star TrueForge (Calling Card draw)

## Decisions (append, do not silently overwrite)

| Date | Decision | Why |
|---|---|---|
| 2026-08-26 | Greenfield repo; process in AGENTS.md before product code | User asked to follow steps and not miss them |
| 2026-08-26 | Public GitHub repo name is DoneCornerAI | User renamed from OfficeOfCTO |
| 2026-08-26 | Superpowers for BE, Impeccable for FE; skills vendored to `.cursor/skills/` | User request |
| 2026-08-26 | Compete on all tracks; know a team can win only one prize | Hackathon rules |
| 2026-08-26 | One job: close pack | Files in → sandbox clean → default dashboard → drill + follow-ups |
| 2026-08-26 | Data: synthetic SaaS pack + CSV/Excel upload | Judges can run; live drop still works |
| 2026-08-26 | Approval = publish / overwrite org Close dashboard | Sandbox analysis is not gated |
| 2026-08-26 | Drill: Period → Function → Account; entity/region is a filter | Clickable bars |
| 2026-08-26 | Org Close board + personal forks | View default; personal edit free; org publish gated |
| 2026-08-26 | Architecture: Next.js portal + TrueForge SDK | Portal owns UX; harness does the work |
| 2026-08-26 | Architecture section approved | Cube clicks skip the LLM; publish is the approval |
| 2026-08-26 | Data: full SaaS CFO catalog; generate Northstar Close Pack | Public files are reference-only unless they score well |
| 2026-08-26 | Agent/MCP approved | Plus schema/metadata explorer and ad-hoc charts or annotations |
| 2026-08-26 | Layout A: nav + board | User picked recommended |
| 2026-08-26 | View/Edit: same board, mode bar | User picked recommended; keep taking recommended for a while |
| 2026-08-26 | Sample pack may load without sandbox; uploads require sandbox | Judges can run if Daytona is missing |
| 2026-08-27 | Default TrueForge model is `openai/gpt-5-4-mini` | Cheapest OpenAI model in the local TrueForge catalog; OpenAI key already added |
| 2026-08-27 | True lake: local files + Postgres catalog (`entities` + `facts`); cube kept for uploads | User chose lake over a single wide table; local Postgres for speed |
| 2026-08-27 | Drill: period → group → vertical → company → category → product → account; P&amp;L cells drill too | CFO hierarchy + table navigation |
| 2026-08-27 | Agent charts pin to any personal board; widgets export CSV/PNG, resize, fullscreen | Demo UX; irreversible org publish still the approval gate |
| 2026-08-27 | Signal Room is the product UI direction | User selected sample 2; exception-first hierarchy keeps lake evidence, agent work, and approval visible |
| 2026-08-27 | TrueForge run ledger replaces direct ingestion orchestration | Judges and users must see real sandbox, MCP, subagents, decisions, artifacts, and approvals |
| 2026-08-27 | Inspect/profile automatically; approve mapping before canonical lake writes | Agent acts while the CFO controls consequential data changes |
| 2026-08-27 | CFO guidance is editable; assembled prompt and immutable policy are read-only | Useful control without allowing safety/tool rules to be removed |
| 2026-08-27 | Personal dashboard drafts auto-save; org publish remains the approval gate | Matches the close-pack spec; Qodo overwrite finding is by design |
| 2026-08-27 | Sample lake reset and quarantined discard require explicit confirm | Destructive, but not org-publish; TrueForge approval stays on mapping and org overwrite |
| 2026-08-27 | Replacing Postgres lake facts requires a current TrueForge `load_lake` approval | Qodo High on PR 14; HTTP `confirm: true` is not an approval-tool outcome |
| 2026-08-28 | Demo blank slate is operator truncate + sqlite wipe, not an HTTP lake reset | Judges must still see Load sample pack → `load_lake` approval; leftover warehouse was why Close opened already filled |
| 2026-08-28 | Register `donecorner` MCP at the live portal origin | `next dev` bound 3001; default PORT 3000 is a hung Next that times out, so TrueForge never reached `load_lake` |
| 2026-08-28 | MCP POST prefers JSON when Accept lists JSON and event-stream | TrueForge sends both; wrapping initialize in SSE left the agent with 0 tools |
| 2026-08-28 | Portal always binds 3000; if taken, kill occupant and restart | Silent hop to 3001 registered MCP at a hung 3000 and broke load_lake |
| 2026-08-28 | Turn JSON must copy status onto the run; load-pack confirm stays in the Signal Room | Header Done + card Running was `ask()` never calling `mergeTurnIntoRun`; `window.confirm` is not a product surface |
| 2026-08-28 | Unwrap TrueForge `call_tool` (`tool_name` + `input`) before lake/mapping authorization | Approve looked dead because the first POST 400'd or took 2–4s with no busy state, then MCP still blocked `load_lake` |
| 2026-08-28 | Agent charts render in the rail; pin later; `present_chart` coerces month names and Cloud-as-vertical | Feb vs August was a 12-month board dump; comparison is one MCP call with `filters.period` |
| 2026-08-28 | Portal Reset clears session/boards, not Postgres facts | Demo replay without an ungated lake truncate |
| 2026-08-28 | Light mode is butter white `#f4ead8`, not pure white | User request; Signal Room tokens invert, orange darkens for contrast |
| 2026-08-28 | Theme from cookie, not a layout `<script>` | React 19 never executes scripts rendered in components |
| 2026-08-28 | Agent transcript auto-scrolls smoothly unless the CFO scrolled up | Chat should follow the latest turn without fighting a reader |
| 2026-08-28 | `lookup_public_company` / `fetch_public_url` MCP on Wikipedia + SEC allowlist | Real-company comparables without open internet/SSRF |
| 2026-08-28 | Public fetch follows redirects only onto the allowlist; JSON uses a larger cap | Qodo High on PR 17: 24k truncation broke EDGAR; auto-follow was SSRF |
| 2026-08-30 | TrueForge runs in-process on the Vercel portal | Production cannot reach localhost:8790; same deployment owns the harness |
| 2026-08-31 | Hosted OpenAI seed uses snake_case `api_key` / `model_id` | Strict TrueForge Zod rejected camelCase; sessions 422'd as unknown model |
| 2026-08-31 | Close-pack sandbox is off on Vercel | No Daytona/bwrap in the function; sample pack still loads without a sandbox |

## Open questions

None blocking. Executing the plan.
