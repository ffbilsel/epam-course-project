# ADR-0007: UI built on Tailwind + shadcn/ui + sonner, RSC-first composition

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-010](../research.md), [Constitution VI & VII](../../../.specify/memory/constitution.md)

## Context

Constitution VI requires a responsive, WCAG-2.1-AA-compliant UI with
the four-states polish (loading / empty / error / success).
Constitution VII demands a single set of design tokens and shared
components — no two buttons that look 80% alike. We also want to
keep client JS payloads small (RSC default).

## Decision

- **Styling**: **Tailwind CSS** with the design tokens declared once
  in `tailwind.config.ts` (colors, spacing, typography, focus ring).
  A CI script (`scripts/check-ui-tokens.ts`) fails the build if a
  raw hex colour or arbitrary spacing value appears in `src/app/**`
  or `src/components/**` — every value must come through the token
  layer.
- **Component primitives**: **shadcn/ui** (vendored, not a runtime
  dep) for accessible Radix-backed primitives (Dialog, Dropdown,
  Tabs, Form). Each primitive is wrapped under
  `src/components/ui/**` so app code imports our wrapper, never the
  raw shadcn export.
- **Icons**: **lucide-react**, single library, single sizing scale.
- **Variants**: **class-variance-authority** for component variants
  (e.g. `Button` size/intent matrix).
- **Toasts**: **sonner**, mounted exactly once in the root layout.
- **Composition**: every page is a Server Component by default;
  `"use client"` is only added at the smallest leaf needed (forms,
  dialogs, optimistic UIs). Forms use **React Hook Form** with the
  shared Zod resolver from [ADR-0006](./0006-validation-and-errors.md).

## Consequences

**Positive**
- Tokens + the CI guard make divergence physically impossible to
  merge.
- shadcn primitives ship accessible by default — Radix handles focus
  trap, keyboard nav, ARIA wiring.
- RSC-first keeps the JS bundle small enough that the Lighthouse
  budget stays comfortable on typical employee hardware.
- Single icon and toast library = no two visual languages.

**Negative**
- shadcn primitives must be reviewed when copied in (we vendor the
  source); breaking changes require a manual sync.
- Tailwind class strings can grow long; we mitigate with `cn()` and
  variant grouping via CVA.
- Client/server split needs vigilance — accidental client tree
  growth is the most common regression.

## Alternatives considered

- **Material UI / Chakra**: heavier runtime, opinionated themes that
  fight Tailwind tokens.
- **Headless UI alone**: less complete than Radix; would force us to
  re-implement Dialog/Tabs.
- **Plain CSS Modules**: no token enforcement, more boilerplate, no
  ecosystem of accessible primitives.
- **react-hot-toast / react-toastify**: comparable to sonner but
  heavier or less RSC-friendly.
