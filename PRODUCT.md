# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

CFOs and finance leaders working through monthly close, exceptions, and board reporting. The primary session starts with a fast scan of material exceptions and moves into analysis or action through the agent.

## Product Purpose

DoneCornerAI turns finance files and a hierarchical lake into navigable dashboards. Success means a CFO can see what matters, drill to the responsible entity or account, ask for analysis, and safely publish the result.

## Positioning

The agent acts rather than only chats: it queries real data through MCP, runs analysis in a sandbox, returns charts that can be pinned to dashboards, and pauses for human approval before irreversible publication.

## Operating Context

The portal is used during close review and executive preparation. It opens in View mode, supports explicit Edit mode, and exposes a group → vertical → company → category → product hierarchy alongside P&L accounts and periods.

## Capabilities and Constraints

- Query Postgres through read-only MCP SQL and structured lake tools.
- Drill charts and P&L cells without involving the language model.
- Export charts, resize or expand dashboard blocks, and pin agent-generated charts to personal dashboards.
- Keep persistent TrueForge sessions and visible agent running, approval, and completion states.
- Org dashboard overwrite requires explicit human approval.
- Preserve realistic synthetic Northstar finance data and public-repo safety.

## Brand Commitments

The product name is DoneCornerAI. Product language should be direct, financially literate, and calm under operational pressure.

## Evidence on Hand

The repository contains the working portal, synthetic Northstar lake data, Postgres-backed queries, dashboard and approval flows, and tests. No customer claims, testimonials, or external benchmarks may be fabricated.

## Product Principles

- Surface exceptions before totals.
- Keep agent work observable and actionable.
- Make every chart navigable and portable.
- Default to safe viewing; make mutation explicit.
- Prefer one complete CFO workflow over a collection of disconnected features.

## Accessibility & Inclusion

Keyboard access, visible focus, high-contrast financial data, and responsive layout are required.
