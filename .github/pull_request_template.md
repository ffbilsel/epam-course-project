# Pull Request

## Summary

<!-- One- or two-sentence description of the change. -->

## Linked artefacts

- Spec / story: <!-- e.g. specs/001-innovatepam-portal-mvp/spec.md#fr-019 -->
- ADR(s): <!-- e.g. ADR-0004 -->
- Issue / task ID: <!-- e.g. T0XX -->

## Constitution gates

> Tick every box. If a gate is intentionally not applicable, explain in
> the description and reference the constitution clause that justifies it.

- [ ] **I — RSC-first**: server work runs in RSC or route handlers; client
      components are leaves with explicit `"use client"` boundaries.
- [ ] **II — Type-safe boundaries**: every cross-process payload is parsed
      with Zod or a schema-bound DTO; no `any` / unchecked casts on the
      boundary.
- [ ] **III — Immutable migrations**: DB changes ship as a new
      `drizzle/NNNN_*.sql` file; existing migrations untouched.
- [ ] **IV — Auditable mutations**: every state-changing API logs a
      structured `security` record via `logSecurityEvent`.
- [ ] **V — Defence-in-depth authorisation**: role checks live in the
      service layer (not just middleware/UI) and are unit-tested.
- [ ] **VI — Errors are typed**: any new error path uses an `ERROR_CODES`
      entry; codes added in this PR are referenced by at least one test
      (`npm run check:error-codes`).
- [ ] **VII — A11y is a release blocker**: new pages/components pass
      `expectNoSeriousAxeViolations` in an E2E spec.
- [ ] **VIII — Design tokens, no hex literals**: colours/spacing come
      from Tailwind tokens (`npm run check:ui-tokens`).
- [ ] **IX — Tests must run from a clean checkout**: contributor docs
      updated if new env vars / setup steps were introduced.
- [ ] **X — ADR for non-trivial decisions**: any new framework, storage,
      transport, or cross-cutting library is recorded under
      `specs/.../adr/`.

## Quality checklist

- [ ] `npm run format` passes
- [ ] `npm run lint` passes
- [ ] `npm run typecheck` passes
- [ ] `npx vitest run --coverage` ≥ 70% line coverage on
      `src/server/**` + `src/lib/**`
- [ ] `npm run test:e2e` passes (or N/A: explain)
- [ ] JSDoc added to all new exported functions/types/interfaces
- [ ] No commented-out code or `console.log` left behind
- [ ] Commit history is purposeful (small, intent-bearing commits)

## Feature-branch hygiene (when merging back to `main`)

- [ ] Squash- or rebase-tidied to remove WIP noise
- [ ] Final merge to `main` uses `--no-ff` so the feature boundary is
      preserved in history
- [ ] Tag/announcement prepared if the change is user-visible
