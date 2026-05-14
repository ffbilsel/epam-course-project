# ADR-0022: Frontend makeover uses Tailwind + CSS-variable design tokens with class-based dark mode

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-4 design
- **Consulted**: shadcn/ui theming convention, Constitution VII.1
- **Informed**: spec FR-032..FR-036, NFR-005

## Context and Problem Statement

Story 5 requires a full visual refresh, a working dark mode, and a
shared layout chrome — without redesigning the navigation IA or the
business workflows. The pages from features 001–003 currently carry
ad-hoc styles and a per-page header; the makeover must consolidate
those without rewriting business logic.

## Decision Drivers

- Constitution VII.1: design tokens come from the Tailwind theme;
  hard-coded hex and inline `style` props are prohibited outside
  `src/components/ui/`.
- FR-033: working light + dark mode toggled by the user (with OS
  preference default), WCAG AA contrast in both modes (NFR-005).
- FR-034: shared layout chrome (top nav + role-aware sidebar).
- FR-035: reusable form/table/empty-state/toast components.
- The codebase already uses shadcn/ui primitives; the shadcn theming
  convention (HSL CSS variables + Tailwind utilities + `.dark` class)
  is the path of least resistance.

## Considered Options

1. **Tailwind + CSS-variable tokens (HSL triplets) + `.dark` class on
   `<html>` toggled by an `AppShell`-level provider** (Decision).
2. Hard-coded `dark:` Tailwind variants on every utility class.
3. Theme via a React context + `style` props.
4. Two Tailwind config files swapped at build time per theme.

## Decision Outcome

Chosen option: **#1**. A single `src/styles/tokens.css` defines CSS
variables for color (HSL triplets), spacing scale, radius scale,
shadow, and font sizes. `tailwind.config.ts` is updated to consume
these variables (e.g.,
`primary: 'hsl(var(--primary) / <alpha-value>)'`). Dark mode toggles
a `.dark` class on `<html>` which re-binds the same variables; every
utility class, every shadcn primitive, and every Recharts chart
inherits the swap without code changes.

A shared `AppShell` component wraps every authenticated page,
providing the top nav, the role-aware sidebar, the theme toggle, and
the page-title slot. Per-page chrome from features 001–003 is removed
in sweep commits that touch only layout (no business-logic edits).

OS preference is honoured by an inline `<head>` script that reads
`localStorage.theme` (set by the toggle) or `matchMedia('(prefers-
color-scheme: dark)')` and sets the `.dark` class **before** React
hydration — this prevents the flash-of-wrong-theme failure mode
FR-033 calls out.

### Positive Consequences

- One source of truth for the entire visual language; Recharts and
  shadcn primitives consume the same variables (ADR-0021).
- Dark mode is a one-line class toggle, no double-classed utilities.
- WCAG AA contrast is verified once per token pair (light + dark);
  every page inherits.
- Removes the per-page chrome from features 001–003 in a contained
  layout-only refactor — business logic stays put.

### Negative Consequences

- Requires updating `tailwind.config.ts` and re-skinning every
  authenticated page. Mechanical work; ADR-bound so the scope cannot
  expand.
- A flash-of-wrong-theme is possible if the inline `<head>` script
  is removed; mitigated by a unit test that asserts the script
  presence in the rendered `<head>`.

## Pros and Cons of the Options

- **Option 2** doubles class-name noise (`bg-white dark:bg-zinc-900`
  on every surface), hostile to future token swaps.
- **Option 3** violates Constitution VII.1 (no inline `style` props
  outside `src/components/ui/`); no SSR parity.
- **Option 4** maintenance burden; goal is *one* design system.

## Links

- Implements [FR-032..FR-036](../spec.md), NFR-005.
- Cooperates with [ADR-0021](./0021-recharts-as-chart-engine.md) —
  Recharts consumes the same CSS variables; dark-mode parity in
  charts is automatic.
