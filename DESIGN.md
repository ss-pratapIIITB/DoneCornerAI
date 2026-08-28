---
name: DoneCornerAI Signal Room
description: An exception-first CFO operations interface built for traceable analysis and controlled action.
colors:
  operations-ink: "#090d12"
  operations-paper: "#eef1f4"
  operations-panel: "#11171f"
  operations-surface: "#0d131a"
  operations-surface-raised: "#151c25"
  hard-line: "#29323d"
  signal-orange: "#ff8a3d"
  muted-data: "#98a3b0"
  danger: "#ff655f"
  focus: "#ffc078"
  chart-blue: "#4d8eff"
  positive: "#40c486"
  analytic-cyan: "#4bc7d6"
  butter-white: "#f4ead8"
  light-ink: "#1c1710"
  light-rail: "#efe4c4"
  light-edit: "#ead9b0"
  light-edit-text: "#8a4a12"
  light-raised: "#fff6e8"
typography:
  headline:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "2rem"
    fontWeight: 600
    letterSpacing: "-0.045em"
  signal:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "1.4rem"
    lineHeight: 1.15
    letterSpacing: "-0.035em"
  numeric:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 600
  body:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    letterSpacing: "-0.005em"
  label:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.64rem"
    fontWeight: 400
    letterSpacing: "0.08em"
  control:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
  instrument:
    fontFamily: "IBM Plex Sans, sans-serif"
    fontSize: "0.65rem"
    fontWeight: 500
rounded:
  square: "0px"
  chart-mark: "2px"
  avatar: "50%"
components:
  signal-action:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.operations-ink}"
    typography: "{typography.control}"
    rounded: "{rounded.square}"
    padding: "0.45rem 0.85rem"
    height: "2.3rem"
  instrument-action:
    backgroundColor: "transparent"
    textColor: "{colors.muted-data}"
    typography: "{typography.instrument}"
    rounded: "{rounded.square}"
    padding: "0.3rem 0.45rem"
  query-field:
    backgroundColor: "{colors.operations-surface}"
    textColor: "{colors.operations-paper}"
    typography: "{typography.body}"
    rounded: "{rounded.square}"
    padding: "0.45rem 0.7rem"
    height: "2.35rem"
  widget-frame:
    backgroundColor: "{colors.operations-surface}"
    textColor: "{colors.operations-paper}"
    rounded: "{rounded.square}"
    padding: "0px"
---

# Design System: DoneCornerAI Signal Room

## Overview

**Creative North Star: "The Signal Room"**

DoneCornerAI is a near-black operations field where ranked financial exceptions carry more visual authority than generic totals. Signal orange is scarce and operational: it marks the primary exception, active control, agent question, or action that demands attention. Hard hairlines, compact instruments, and dense tabular numbers make the interface feel like a live close-review console rather than a card dashboard.

The system is direct, financially literate, and calm under pressure. It exposes data lineage, agent activity, and irreversible approval as visible working states. The chosen world rejects soft consumer-dashboard decoration and reserves expressive hierarchy for evidence, status, and action.

**Key Characteristics:**
- Exception-first hierarchy instead of equal-weight metric cards.
- Near-black flat surfaces separated by tone and hard hairlines.
- Signal orange used for priority, active state, and controlled action.
- Dense IBM Plex Sans typography with tabular financial numerals.
- Square, compact controls with explicit keyboard focus.
- Observable agent work and unmistakable human approval.

## Colors

The palette is a restrained operations spectrum: near-black neutrals carry the workload while signal orange and analytical channels encode meaning.

### Primary
- **Signal Orange:** Use for the highest-priority exception, selected or active actions, agent questions, resize affordances, and approval emphasis. It is an operational signal, not ambient decoration.

### Secondary
- **Chart Blue:** The default quantitative chart mark.
- **Positive Green:** Reserved for favorable or successful analytical meaning.
- **Analytic Cyan:** An alternate analytical series or informational channel.
- **Danger Red:** Errors and destructive denial treatment only.
- **Focus Amber:** The universal visible keyboard-focus outline.

### Neutral
- **Operations Ink:** Page field and deepest input background.
- **Operations Panel:** persistent rails and stronger shell regions.
- **Operations Surface:** charts, queues, tables, and widget interiors.
- **Raised Operations Surface:** hover, table-header, and selected tonal layer.
- **Operations Paper:** primary text and inverse active-control text.
- **Muted Data:** secondary labels, metadata, axes, and inactive controls.
- **Hard Line:** borders, dividers, chart axes, and structural separation.

### Light field

Daytime review uses the same Signal Room geometry on butter white (`#f4ead8`), not pure white. Ink and paper invert: dark text on warm paper, slightly deeper cream for rails and panels. Signal orange darkens so it still reads on the butter ground. Dark / Light lives in the top bar and persists in the browser.

### Named Rules

**The Signal Scarcity Rule.** Signal orange identifies priority or action; never wash large passive regions with it.

**The Semantic Channel Rule.** Blue, green, cyan, danger, and focus colors retain their assigned analytical or state meaning.

## Typography

**Display Font:** IBM Plex Sans (with sans-serif fallback)  
**Body Font:** IBM Plex Sans (with sans-serif fallback)  
**Label/Mono Font:** IBM Plex Sans with tabular numerals

**Character:** A single utilitarian grotesk keeps headings, controls, agent copy, and financial tables in one operational voice. Tight headline tracking and tabular figures create density without sacrificing scan speed.

### Hierarchy
- **Headline:** Board identity and major surface heading; compact, tightly tracked, and never oversized.
- **Signal:** The primary exception statement; more forceful than the surrounding dashboard title.
- **Numeric:** Material KPI values in the signal strip.
- **Body:** Default interface and explanatory copy.
- **Label:** Uppercase context, status, metadata, and instrument labels; use the wider tracking defined by the token.
- **Control:** Primary mode, query, load, publish, and approval controls.
- **Instrument:** Compact export, fullscreen, breadcrumb, pin, and widget controls.

### Named Rules

**The Numbers Align Rule.** Financial values use tabular numerals and right alignment wherever comparison is the task.

**The Exception Speaks First Rule.** The primary exception may outrank the page title; routine totals may not.

## Layout

The shell uses a compact navigation rail, a fluid central work field, and a persistent agent rail. The central canvas is full-width up to a wide operational maximum, with compact gutters that scale slightly on large screens. Internal composition uses hard-edged grids and restrained gaps rather than independent floating cards.

At `1180px` and below, the shell changes from three columns to a compact navigation rail plus main column. The agent rail leaves the right edge and becomes a full-width region below the main work field, with its left border removed and a top hairline added.

At `780px` and below, the shell becomes a block flow. Primary navigation becomes a horizontal strip, the top bar wraps, the contextual query takes a full row, and signal-strip and signal-workspace grids collapse to one column. The ranked exception queue moves before the revenue plot. Widget widths are forced to the viewport, action groups expand, and compact controls receive a `2.75rem` minimum target height.

On mobile, the agent becomes a fixed, collapsible bottom bar with a `70vh` maximum expanded height. The collapsed state keeps its status visible; capabilities, transcript, and approval controls are hidden. Approval forces the rail expanded so the decision cannot be concealed.

**The Operational Density Rule.** Preserve compact controls and close spatial relationships on desktop; increase target size, not decorative whitespace, on mobile.

## Elevation & Depth

The system is flat and uses no shadows. Depth comes from a strict tonal sequence between ink, panel, surface, and raised surface, reinforced by one-pixel hard lines and an occasional two-pixel signal edge. Modal focus uses the browser's native dialog layer and a dark translucent backdrop, not a floating drop shadow.

**The Flat Field Rule.** Never introduce card shadows, glows, glass effects, or soft elevation; use tone and borders to establish depth.

## Shapes

The component vocabulary is square and hard-lined. Buttons, inputs, status badges, queues, panels, tables, tooltips, and dialogs use square corners. Hairline borders and clipped rectangular fields establish the instrument-panel character.

The only intentional exceptions are the circular user avatar and the slight rounding on chart marks. These are contained data or identity marks, not permission to soften interface containers.

**The Hard-Line Rule.** Structural UI stays square; rounded silhouettes are exceptional and role-specific.

## Components

### Buttons
- **Signal actions:** Orange field with ink text for primary load, publish, submit, and approval actions.
- **Instrument actions:** Transparent field, muted text, and a hard-line border for export, fullscreen, breadcrumb, pin, and secondary controls.
- **Hover / active:** Available controls brighten slightly; widget instruments also shift toward paper text and a stronger border.
- **Focus:** Every interactive element receives the same two-pixel focus outline with a two-pixel offset.
- **Disabled / loading:** Disabled controls reduce opacity and use a not-allowed cursor. Loading actions replace their label with an explicit progress verb and remain disabled.
- **Approval semantics:** Approve uses the signal action. Deny remains transparent with danger text and border so refusal is explicit without competing with the pending action.

### Inputs / Fields
- **Style:** Near-black or operations-surface fill, hard-line border, square corners, paper text, signal-orange caret.
- **Focus:** Use the global focus treatment without moving layout.
- **Disabled:** Reduce opacity, block submission, and explain unavailability in the field placeholder.
- **Error:** Keep the field geometry stable and render concise danger-colored copy nearby.

### Navigation and Mode Control
- **Primary navigation:** Compact icon-and-label instruments; inactive items are muted, hover/active items gain the raised tonal layer, and the active route receives a signal-orange left edge.
- **Mobile navigation:** Converts to a horizontal strip while retaining labels and full target size.
- **View / Edit mode:** A bordered two-segment control. The active segment inverts to paper on ink. Edit mode also exposes a separate amber-toned strip explaining that the personal board is mutable and org publication requires approval.

### Close Signal Strip and Exception Queue
- **Signal strip:** A full-width, signal-edged band for one primary exception plus supporting coverage and income statistics. This is a Signal Room composition pattern, not a requirement for unrelated surfaces.
- **Exception queue:** A ranked ordered list with index, uppercase account, actual value, and orange variance. Rows use hairline separators and the raised tonal hover layer; choosing a row changes the active chart query.
- **Empty / error / loading:** Preserve the same region geometry and replace data with concise operational copy rather than decorative placeholders.

### Charts and P&L
- **Charts:** Flat plotting area between hard horizontal lines, blue bars, muted axes, square tooltip, and no entry animation. Clicking a bar or matching drill key descends the lake hierarchy.
- **Breadcrumbs:** The Up control reverses one drill level and keeps the active metric, grain, and filter context visible.
- **P&L table:** Sticky header and first column, right-aligned tabular values, hairline rows, and direct period/account/cell drill actions.

### Widget Frame
- **Container:** Operations surface, hard-line perimeter, square corners, zero outer token padding; header and body own their compact insets.
- **Fullscreen:** Use a native modal `dialog`. Opening moves focus to Close, Escape closes through the cancel path, and closing restores focus to the invoking control. The modal fills the viewport behind a dark backdrop and retains the same hard-lined widget language.
- **Resize:** A visible orange lower-right corner affords pointer drag. Width is constrained from `40%` to `100%`; height from `14rem` to `56rem`. Arrow keys resize by `4%` horizontally and `2rem` vertically, and the control exposes its keyboard shortcuts and label.

### Agent Rail
- **Persistent state:** Status always distinguishes Idle, Running, Waiting for approval, Done, and Error. Running uses a restrained opacity pulse; reduced-motion preference collapses animation and transitions to effectively immediate state changes.
- **Transcript:** Questions use signal orange and uppercase instrument labeling; responses remain paper text with readable line height.
- **Approval:** Pending actions name what will happen, explain that review is required, and expose explicit approve and deny controls before the irreversible step.
- **Mobile:** Fixed and collapsible at the bottom edge; status remains visible when collapsed, while approval automatically expands the rail.

## Do's and Don'ts

### Do:
- **Do** lead operational surfaces with ranked exceptions and traceable evidence.
- **Do** separate flat regions with the established tonal sequence and hard hairlines.
- **Do** keep agent status, pending action, and approval controls visible at the moment of consequence.
- **Do** preserve keyboard focus, native dialog focus return, keyboard resizing, and mobile target sizing.
- **Do** keep chart marks and P&L cells directly navigable.

### Don't:
- **Don't** revert the Signal Room to an equal-weight generic card dashboard.
- **Don't** add shadows, glows, glassmorphism, or soft rounded containers.
- **Don't** use signal orange as broad decoration or for passive information.
- **Don't** hide publication approval in a transcript, toast, or collapsed mobile panel.
- **Don't** promote the Close surface's exact signal-strip composition into a universal layout requirement.
