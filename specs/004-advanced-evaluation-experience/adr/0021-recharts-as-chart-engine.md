# ADR-0021: Insights charts use Recharts

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-4 design
- **Consulted**: spec clarification 3, shadcn/ui ecosystem, NFR-001, NFR-005
- **Informed**: spec FR-025..FR-031, Story 5 makeover

## Context and Problem Statement

Story 4 requires three charts (Submission Trend, Approval Rate,
Category Distribution) and Story 5 demands a coherent visual language
across the makeover. The spec leaves the charting technology open and
asks the implementation plan to pick one consistent with the existing
Next.js + Tailwind + shadcn/ui stack.

## Decision Drivers

- NFR-001: each chart renders its initial data in ≤ 2 s at 10 000
  ideas.
- NFR-005: WCAG AA on every new surface; charts must be screen-reader
  reachable and respect `prefers-reduced-motion`.
- Story 5 makeover: charts must adopt the same design tokens as the
  rest of the portal (light + dark mode, no hard-coded hex).
- Constitution VII.1: components consume the shadcn/ui primitives
  where one exists.

## Considered Options

1. **Recharts `^2.12`** (Decision).
2. Hand-rolled SVG components.
3. Chart.js (Canvas).
4. Visx.
5. `@nivo/*`.
6. ECharts.

## Decision Outcome

Chosen option: **#1**. Recharts is the React-idiomatic chart library
used by the official shadcn `chart` component. The three Insights
charts are built as thin client-component wrappers in
`src/components/insights/charts/*`, each receiving its data from a
small SWR fetch against `/api/insights/*`. Recharts is configured to
read CSS variables defined in `src/styles/tokens.css` (ADR-0022) so
dark-mode swaps automatically.

Each chart adds explicit:

- ARIA `role="img"` + `aria-label` on the outer `<ResponsiveContainer>`.
- `accessibilityLayer` prop where supported (Recharts 2.10+) to expose
  a screen-reader-friendly data summary.
- Hover tooltip with exact numeric values (FR-030).
- Per-chart empty state when the response is `data: []` (FR-030,
  Edge Case "zero matching ideas").
- `prefers-reduced-motion`-aware animation duration (0 ms when set).

The three chart endpoints are server-rendered RSC-friendly; the chart
*rendering* is client-side because Recharts depends on `ResizeObserver`.

### Positive Consequences

- One new runtime dependency, lockfile-pinned. Bundle delta
  ≈ 70 kB gzipped, code-split on the Insights route.
- Visual consistency with the shadcn `chart` primitive lands "for
  free" — Story 4 charts and Story 5 makeover share styling.
- ARIA + reduced-motion + keyboard focus come from the library;
  zero bespoke a11y plumbing.
- The Recharts SVG output respects the dark-mode CSS variables
  without re-renders.

### Negative Consequences

- Adds 70 kB to the Insights bundle. Acceptable: Insights is an
  Admin/Evaluator-only route, lazy-loaded, with an explicit caching
  story (SWR).
- Recharts has a non-trivial API surface; we constrain ourselves to
  `AreaChart`, `BarChart`, and `ComposedChart` to keep the learning
  curve flat.

## Pros and Cons of the Options

- **Option 2** would re-implement tooltips, axes, legends, focus,
  and reduced-motion for three chart types — exactly the kind of
  unbounded yak-shave the spec warns against.
- **Option 3** Canvas-based; ARIA is hard to do correctly; clashes
  with NFR-005.
- **Option 4** lower-level than Recharts; valuable for bespoke
  visualisations, overkill for three off-the-shelf chart types.
- **Option 5** larger bundle, more peer-dep complexity.
- **Option 6** very large bundle; imperative API does not fit RSC.

## Links

- Implements [FR-025..FR-031](../spec.md).
- Cooperates with [ADR-0022](./0022-makeover-design-tokens.md) —
  charts consume the same CSS variables as the rest of the portal.
