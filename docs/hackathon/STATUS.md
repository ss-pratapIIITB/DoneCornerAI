# Living checklist

Update this file whenever a step starts or finishes. Do not skip.

Hackathon ends **Sun 30 Aug 2026, 20:00 London**. Today when this was created: **Wed 26 Aug 2026**.

## Now

**Phase:** 3/4 — Build (agentic ingestion + observable workspace)

**Current step:** Observable ingestion and the unified agent workspace are implemented. Qodo High findings and the first PR #11 Medium follow-up batch are fixed; PR #12 Medium findings are next before dashboard DSL.

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
- [ ] Validated agent-designed dashboard DSL
- [ ] Editable CFO guidance + read-only assembled prompt

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

## Open questions

None blocking. Executing the plan.
