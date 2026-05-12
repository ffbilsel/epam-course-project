# ADR-0001: Next.js 14 App Router with React Server Components

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-001](../research.md), [plan.md](../plan.md)

## Context

The MVP is a small internal web app (a few dozen routes, single-DB,
single-tenant) with three user-visible surfaces (Employee, Evaluator,
Admin) and a handful of REST endpoints. The team is comfortable with
TypeScript, wants to ship one repository, and needs server-side
rendering for SEO-irrelevant but auth-protected pages.

Constraints from [the constitution](../../../.specify/memory/constitution.md):

- Strict TypeScript everywhere (Principle II).
- WCAG 2.1 AA + responsive UI (Principle VI) → SSR-first reduces
  hydration weight and keyboard-flow issues.
- Single-process operation in dev (no separate frontend & API).

## Decision

Use **Next.js 14+ with the App Router and React Server Components
(RSC) as the default**. Client components are introduced only when
explicit interactivity (forms, dialogs, optimistic updates) is needed.
API endpoints live as **Route Handlers** under `src/app/api/**` in the
same project, sharing types and Zod schemas with the UI.

## Consequences

**Positive**
- Single repo, single dependency tree, one `npm run build`.
- Server components let us read from the DB directly without writing
  client fetch glue, shrinking the JS payload.
- Route Handlers + Zod give us a consistent boundary contract that the
  OpenAPI spec mirrors 1-to-1.

**Negative**
- App Router is opinionated; team must learn the RSC mental model and
  the `"use client"` boundary.
- Some library ecosystems (state managers, animation libs) still
  default to client-only assumptions.

## Alternatives considered

- **Pages Router**: stable but RSC-incompatible; would force a
  duplicated data-fetching layer.
- **SPA (Vite + React) + separate Express API**: two repos, two
  build pipelines, two type systems to keep in sync — overkill for
  the MVP.
- **Remix**: comparable DX but smaller component ecosystem and no
  App-Router-equivalent RSC story at the time of writing.
