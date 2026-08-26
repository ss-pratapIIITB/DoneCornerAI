# Living checklist

Update this file whenever a step starts or finishes. Do not skip.

Hackathon ends **Sun 30 Aug 2026, 20:00 London**. Today when this was created: **Wed 26 Aug 2026**.

## Now

**Phase:** 2 — Plan executing on `feat/close-pack` (PR 5)

**Current step:** Tasks 1–9 done. Remaining: TrueForge MCP + approval rail, README/demo.

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

- [ ] TrueForge local harness + model + sandbox
- [ ] Data plane (sample finance pack + MCP)
- [ ] Agent: ingest → sandbox analysis → insights (subagents)
- [x] Portal shell: view default, edit toggle
- [x] Default dashboard + custom dashboards
- [x] Navigable charts (click filter, drill down/up)
- [ ] On-the-fly query → explanation / chart
- [ ] Approval gate on publish / sensitive export
- [ ] Persistent session survives refresh
- [ ] Impeccable Operate UI pass + browser verify

## Phase 4 — Hackathon evidence

- [ ] Qodo installed on the repo
- [ ] Every substantive change via PR; High findings fixed or dismissed with reason
- [ ] README: runbook + `## Qodo Code Review Evidence`
- [ ] ~3 min demo script (tool + sandbox + approval visible)
- [ ] Field Report draft
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

## Open questions

None blocking. Executing the plan.
