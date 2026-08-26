# Office of the CTO — Agent Instructions

Public GitHub repo: [ss-pratapIIITB/DoneCornerAI](https://github.com/ss-pratapIIITB/DoneCornerAI).

CFO intelligence portal for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge) (24–30 Aug 2026). Deadline: **30 Aug 2026, 20:00 London**.

A chatbot answers. This agent **acts**: it processes finance data, runs analysis in a sandbox, builds navigable dashboards, and stops for a human before irreversible steps.

## Product (working)

Portal for CFOs to process data and get insights.

- Opens in **view mode**. Edit mode is explicit.
- People create their own dashboards.
- On-the-fly queries for explanations, insights, or charts.
- Charts are navigable: click a bar to filter, drill down, or drill up.

Do not implement until the current spec in `docs/superpowers/specs/` is approved and a plan exists in `docs/superpowers/plans/`.

## Skills (required)

Skills live in `.cursor/skills/`. Invoke the matching skill **before** acting.

| Work | Skill | When |
|---|---|---|
| Any session | `using-superpowers` | First. If a skill might apply, use it. |
| New product / feature | `brainstorming` | Before any code. Spec → user approval. |
| After approved spec | `writing-plans` | Bite-sized TDD tasks. |
| Backend / logic | `test-driven-development`, `systematic-debugging`, `verification-before-completion` | Red-green-refactor. Evidence before "done". |
| Plan execution | `subagent-driven-development` or `executing-plans` | Task by task, no skips. |
| Frontend / UI | `impeccable` | Shape, Operate mode, craft floor, browser verify. |
| Isolation | `using-git-worktrees` | Feature work off main. |
| Ship | `requesting-code-review`, `finishing-a-development-branch` | Before merge / PR. |

Startup speed means **short loops**, not skipped loops: brainstorm (tight) → spec → plan → slice → PR.

## Hackathon tracks (design to win all; a team can take only one prize)

| Track | Prize | What judges must see |
|---|---|---|
| Double-O | NVIDIA DGX Spark | TrueForge doing real work: MCP tools, sandbox execution, human approval, subagents, persistent sessions. |
| Q Branch | Mac Mini | Qodo reviews on every substantive PR. README evidence section. Repo a stranger can clone. |
| Savile Row | iPad | UI a stranger can drive. Show what the agent is doing, waiting on, and did. Approval **before** irreversible steps. Demo video + running app. |
| Field Report | Keychron | Blog: problem, wiring, what TrueForge handled, what broke. |
| Radio Traffic | Swag | Social clips while building. Tag WeMakeDevs, TrueFoundry, Qodo. |
| Universal Exports | Interviews | Top projects. No separate entry. |

**Qualification bar:** judges must see a real tool reached, code run in the sandbox, and a pause for a person. If it would work as a chat box, it does not qualify.

## TrueForge (must be the harness, not a wrapper)

Use the HTTP API + TypeScript SDK (`@truefoundry/trueforge-core`) and embed UI where it helps (`@truefoundry/trueforge-ui`). Local: `npx @truefoundry/trueforge`.

The agent must:

1. Reach real tools via **MCP** (files, warehouse, or our data MCP).
2. Execute generated analysis code in the **sandbox**.
3. **Pause for approval** before publish, export of sensitive data, overwrite, or delete.
4. **Delegate** (subagents) for parallel slices of analysis.
5. Keep **persistent sessions** across refresh / reconnect.

## Process — do not skip

Living checklist: [`docs/hackathon/STATUS.md`](docs/hackathon/STATUS.md). Update it when a step starts or finishes.

```
1. Brainstorm     → one question at a time, then design approval
2. Spec           → docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md
3. Plan           → docs/superpowers/plans/YYYY-MM-DD-<feature>.md
4. Implement      → TDD on backend; Impeccable on frontend
5. Verify         → tests + browser (view/edit, drill-down, query, approval)
6. PR             → branch, Qodo review, fix High findings, human merge
7. Evidence       → README Qodo section, demo script, blog notes, social clip
```

Never push straight to `main` for substantive work.

## Portal UX rules

- Default **view**. Edit requires an explicit control.
- View: inspect, filter, drill, query. No layout mutation.
- Edit: dashboards, widgets, queries. Publish / overwrite needs approval.
- Click a chart mark to filter or drill. Breadcrumbs to drill up.
- Query bar always available for explanation / insight / new chart.
- Show agent activity: running, waiting for approval, done.

## Engineering

- Public repo, README a stranger can follow. Secrets stay out of git and the demo video.
- Sample / synthetic finance data so judges can run without our credentials.
- One vertical slice end-to-end beats three half-finished platforms.
- Keep units small, interfaces explicit, files focused.

## Session start

1. Read this file and `docs/hackathon/STATUS.md`.
2. Invoke `using-superpowers`, then the skill for the current STATUS step.
3. Do not jump ahead of the checklist.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
