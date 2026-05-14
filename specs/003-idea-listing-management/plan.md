# Implementation Plan: Idea Listing & Management Enhancements (Phase 3)

**Branch**: `003-idea-listing-management` | **Date**: 2026-05-14 |
**Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from
`/specs/003-idea-listing-management/spec.md`

## Summary

Add four day-to-day workflow capabilities on top of the Phase 1/2
codebase, without disturbing the existing idea state machine or
attachment rules:

1. **Edit & delete own idea** while the idea is still `SUBMITTED`
   (Story 1, P1). Beyond that status the existing
   `IDEA_ALREADY_DECIDED` philosophy applies and the controls
   disappear from the UI and are rejected by the API.
2. **Server-side search & filter** on every listing surface — free
   text on title+description, single category, status set, and a
   `submittedFrom` / `submittedTo` date range, combined with AND
   semantics and reflected in the URL (Story 2, P1).
3. **Pagination** with selectable page size (20/50/100), total count,
   URL-bound `page` parameter, and automatic clamp on out-of-range
   pages (Story 3, P2).
4. **Per-idea History tab** that surfaces submission, author edits,
   and the existing `status_transitions` audit rows in a single
   chronological list on the detail page (Story 4, P2).
5. **Admin-only CSV export** of the current filtered set, streamed
   over all matching rows (not just the visible page), RFC 4180
   compliant, with the action recorded as a security event
   (Story 5, P3).

The feature is **mostly additive**: no new tables, no changes to the
idea state-machine grammar, and no new third-party runtime
dependencies. Editing extends the existing repository and validator
surface; the history tab joins the existing `status_transitions`
table with two synthesised event kinds (`SUBMITTED` derived from
`ideas.createdAt` and `EDITED` recorded as an audit-only row in the
same table). The CSV export reuses the search-and-filter query path
so admins always get exactly what the listing shows.

## Technical Context

**Language/Version**: TypeScript ~5.4 (strict mode unchanged from
Phase 1/2); Node.js `>=20 <21`.
**Primary Dependencies**: unchanged from Phase 2 — Next.js 14 (App
Router), React 18, Tailwind CSS, shadcn/ui, Zod, React Hook Form +
`@hookform/resolvers/zod`, NextAuth v5 + Drizzle adapter, Drizzle
ORM + `better-sqlite3`, `date-fns`, `lucide-react`,
`class-variance-authority`, `sonner`. **No new runtime
dependencies**: CSV is built by a tiny in-house writer (a ≤ 30-LOC
RFC 4180 escaper); pagination, search, and filter are plain
Drizzle predicates.
**Storage**: SQLite via `better-sqlite3`. **Schema delta**
(Drizzle migration `drizzle/0002_listing_and_edits.sql`):

1. The existing `status_transitions.to_state` CHECK constraint is
   widened to accept the new audit-only kind `EDITED`. The constraint
   keeps `EDITED` legal *only* when `from_state = to_state` so it
   cannot smuggle a new lifecycle step past the state machine. See
   ADR-0015.
2. New compound index `idx_ideas_search` over
   `(status, category_id, created_at)` to make the listing query
   plan covering for the most common filter sets. The author-filter
   index `idx_ideas_author_updated` from Phase 1 already covers the
   employee scope. SQLite's `LIKE` on title/description stays
   uncovered but is acceptable at the spec's scale target
   (≤ 10 000 ideas).
3. **No new tables.** Pagination, search, and filter are query-time
   concerns. Hard delete uses the existing `ON DELETE CASCADE` on
   `attachments` and `status_transitions`.

**Testing**: Vitest 1.6 (`unit` + `integration` projects), RTL 16,
Playwright 1.45 with `@axe-core/playwright`. Coverage thresholds
unchanged (≥ 70% line on `src/server/**` and the business-logic
subset of `src/lib/**`).
**Target Platform**: identical to Phase 1/2 (Chromium/Firefox/Safari
on desktop/tablet/mobile ≥ 360 px).
**Project Type**: Full-stack web app (Next.js, single repo).
**Performance Goals**:

- 95% of listing page loads complete server-side in **< 500 ms** at
  the spec's scale target (SC-004).
- Free-text search across title + description responds in
  **< 200 ms** on 10 000 rows (SC-003).
- CSV export of 10 000 rows completes in **< 10 s** (SC-006).
  Achieved by streaming `Buffer` chunks via a `ReadableStream`
  rather than buffering the whole CSV in memory.

**Constraints**: no external services, no new UI library, no new
runtime dependency. Edit is offered only while `status = SUBMITTED`
(Assumption 1 of the spec). Hard delete (Assumption 8) cascades to
`idea_answers`, `attachments`, and `status_transitions`. No new role
is introduced; existing role guards govern visibility of Edit /
Delete / Export.
**Scale/Scope**: ≤ 1 000 active users, ≤ 10 000 ideas. 27 functional
requirements (FR-001…FR-027), 5 user stories, 1 new audit-event kind
(`EDITED`), 5 new API surfaces (`PATCH /api/ideas/[id]`,
`DELETE /api/ideas/[id]`, `GET /api/ideas` with filter+page params,
`GET /api/ideas/export`, `GET /api/ideas/[id]/history`), ~6 React
components or component changes, 4 ADRs (ADR-0013…0016).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at **v1.4.0** has **10 principles** and **12
quality gates**. Each is evaluated below for this plan; **no
violations require justification**.

### Principle compliance

| Principle | Compliance |
|---|---|
| **I. Clean Code** | Three new server modules (`idea-listing.ts`, `idea-export.ts`, `idea-history.ts`) are single-purpose; each public function ≤ 30 logical lines. The listing query builder is a pure data-in/data-out function. No dead code; no inline TODOs. |
| **II. TypeScript Strict** | The listing query type is a Zod-parsed `ListingQuery` discriminated by scope (`mine` vs. `queue` vs. `all`). `URLSearchParams` payloads pass through a single `parseListingQuery()` adapter so untyped data never reaches the service. No `any`, no `!`, no `@ts-ignore`. |
| **III. Testing Pyramid 70%** | New business logic (`idea-listing.ts`, `idea-export.ts`, `idea-history.ts`, the edit/delete branches in `idea-service.ts`) sits in `src/server/**` and `src/lib/validation/**`, both covered. Threshold unchanged. |
| **IV. JSDoc** | Every exported function, type, and component prop gets a JSDoc block (`@param` + `@returns` + `@throws` where applicable). |
| **V. Testing Principles** | AAA layout; `beforeEach` isolation; in-memory or fresh-SQLite fakes. Listing parameters tested with `it.each` tables; the edit/delete state-machine guard is unit-tested as a pure function (one assertion per case). |
| **VI. UX (responsive, a11y, polish)** | Search input is debounced and reflected in the URL via `useSearchParams` so back/forward works. Filter chips use shadcn `Badge` + `Button` primitives; pagination uses an existing shadcn pattern. Empty / loading / error / success states present on the listing and the history tab. Destructive action ("Delete idea") requires confirmation in a `Dialog` and uses the `destructive` button variant. Mobile-first; filter bar collapses into a single accordion below `sm:`. `@axe-core/playwright` runs against the listing, the edit form, and the history tab. |
| **VII. Consistency (UI, code, error codes)** | New error codes added to `src/lib/errors/codes.ts`: `IDEA_NOT_EDITABLE`, `IDEA_NOT_DELETABLE`, `IDEA_LISTING_RANGE_INVALID`, `IDEA_LISTING_PAGE_INVALID`, `IDEA_LISTING_SEARCH_TOO_LONG`, `IDEA_EXPORT_FORBIDDEN_FILTER`. UI strings live in `error-messages.ts`. URL-state hook (`useListingQuery`) replaces ad-hoc `URLSearchParams` plumbing. No hex/arbitrary Tailwind values. CSV writer lives in `src/lib/format/csv.ts` next to `formatDate`. |
| **VIII. Commit & Push Discipline** | SpecKit `auto_commit` hooks (`.specify/extensions.yml`) plus the `post-commit` push hook continue to drive Conventional Commits + immediate `git push` per lifecycle step and per task. |
| **IX. ADR-Backed Design Choices** | Every load-bearing choice has a MADR ADR under [./adr/](./adr/): edit/delete cutoff at `SUBMITTED` (ADR-0013), listing query design — server-side, URL-bound, AND semantics (ADR-0014), `EDITED` audit-row encoding inside `status_transitions` (ADR-0015), and CSV export streaming strategy (ADR-0016). |
| **X. Feature Merge Discipline** | Feature branch `003-idea-listing-management` merges to `main` exclusively via `git merge --no-ff` once Quality Gates 1–11 pass. Encoded as the final task in `tasks.md`. |

### Quality gates

| # | Gate | How this plan satisfies it |
|---|---|---|
| 1 | `tsc --noEmit` strict | unchanged; `npm run typecheck` in CI. |
| 2 | ESLint + Prettier zero errors | unchanged toolchain. |
| 3 | Unit + integration + E2E pass | new tests in each tier (see [./quickstart.md](./quickstart.md)). |
| 4 | ≥ 70% line on business logic | new modules `idea-listing.ts`, `idea-export.ts`, `idea-history.ts`, `csv.ts`, and the edit/delete branches in `idea-service.ts` covered ≥ 70%. |
| 5 | JSDoc on exports | `eslint-plugin-jsdoc` enforces. |
| 6 | Code review / Constitution note | solo course project — self-review with rationale per PR. |
| 7 | Constitution Check | this section. |
| 8 | A11y/responsiveness | jsx-a11y + axe; manual checklist for the listing filters and edit dialog at all three breakpoints. |
| 9 | Consistency | 6 new codes added with one-test-per-code; the error envelope is reused unchanged. CSV writer is reused for any future export. |
| 10 | Commit & push discipline | inherited automation. |
| 11 | ADR coverage | ADR-0013…0016 cover every new design choice; ADR index `specs/003-idea-listing-management/adr/README.md` lists them. |
| 12 | Feature merge-back | final task performs `git merge --no-ff` to `main`. |

### Excluded coverage paths (documented per V.2)

Unchanged from Phase 1/2: `src/app/**` page/layout files,
`src/components/ui/**`, `src/lib/errors/codes.ts`,
`drizzle/**`, `src/db/seed.ts`. New listing components live under
`src/components/ideas/**` and **are** in scope for the 70% floor as
business logic adjacent to the listing query.

**Result**: PASS. Re-check after Phase 1 design — no expected drift.

## Project Structure

### Documentation (this feature)

```text
specs/003-idea-listing-management/
├── plan.md              # This file
├── spec.md              # Authoritative spec
├── research.md          # Phase 0 — decisions & alternatives
├── data-model.md        # Phase 1 — listing query, edit, history, export shapes
├── quickstart.md        # Phase 1 — run/test/migrate locally
├── adr/
│   ├── README.md
│   ├── 0013-edit-delete-cutoff.md
│   ├── 0014-listing-query-design.md
│   ├── 0015-edited-audit-row.md
│   └── 0016-csv-export-streaming.md
├── contracts/
│   └── openapi.yaml     # Phase 1 — REST delta for edit, delete, listing, history, export
├── checklists/
│   └── requirements.md  # Already authored by /speckit.specify
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root) — additions and changes only

```text
project/
├── drizzle/
│   └── 0002_listing_and_edits.sql                 # NEW migration (CHECK rewrite + index)
├── src/
│   ├── app/
│   │   ├── (employee)/
│   │   │   ├── my-ideas/page.tsx                  # CHANGED — search/filter/paginate UI
│   │   │   └── ideas/
│   │   │       ├── [id]/page.tsx                  # CHANGED — Edit/Delete + History tab
│   │   │       └── [id]/edit/page.tsx             # NEW — edit form (Story 1)
│   │   ├── (reviewer)/queue/page.tsx              # CHANGED — same search/filter/paginate
│   │   ├── (admin)/admin/ideas/page.tsx           # NEW — admin all-ideas listing + Export
│   │   └── api/
│   │       └── ideas/
│   │           ├── route.ts                       # CHANGED — accept listing query params
│   │           ├── [id]/route.ts                  # CHANGED — add PATCH + DELETE
│   │           ├── [id]/history/route.ts          # NEW — GET history events
│   │           └── export/route.ts                # NEW — admin CSV export (streamed)
│   ├── components/
│   │   ├── ideas/
│   │   │   ├── idea-filter-bar.tsx                # NEW — search + filter chips (URL-bound)
│   │   │   ├── idea-pagination.tsx                # NEW — page controls + page-size select
│   │   │   ├── idea-history-tab.tsx               # NEW — Story 4
│   │   │   ├── delete-idea-dialog.tsx             # NEW — confirm dialog (destructive)
│   │   │   └── edit-idea-button.tsx               # NEW — visibility gated on canEdit
│   │   ├── admin/
│   │   │   └── export-ideas-button.tsx            # NEW — Story 5 trigger
│   │   └── forms/
│   │       └── idea-form.tsx                      # CHANGED — reusable for create + edit
│   ├── server/
│   │   ├── idea-service.ts                        # CHANGED — editIdea, deleteIdea, history
│   │   ├── idea-listing.ts                        # NEW — buildListingQuery + run + count
│   │   ├── idea-export.ts                         # NEW — streamed CSV from listing query
│   │   └── idea-history.ts                        # NEW — fold ideas + transitions into events
│   ├── db/
│   │   └── repositories/
│   │       ├── idea-repo.ts                       # CHANGED — listFiltered + countFiltered + updateIdea + hardDelete
│   │       └── transition-repo.ts                 # CHANGED — insertEditedMarker
│   ├── lib/
│   │   ├── format/
│   │   │   └── csv.ts                             # NEW — RFC 4180 row writer (streaming-friendly)
│   │   ├── hooks/
│   │   │   └── use-listing-query.ts               # NEW — URL-state hook for listing
│   │   ├── validation/
│   │   │   ├── idea.ts                            # CHANGED — UpdateIdeaSchema + ListingQuerySchema
│   │   │   └── pagination.ts                      # NEW — page/pageSize parser shared by listing & export
│   │   └── errors/
│   │       ├── codes.ts                           # CHANGED — add 6 new codes
│   │       └── error-messages.ts                  # CHANGED — UI copy for new codes
│   └── types/index.ts                             # CHANGED — re-export listing + history types
├── tests/
│   ├── unit/
│   │   ├── lib/format/csv.test.ts                              # NEW
│   │   ├── lib/validation/listing-query.test.ts                # NEW
│   │   ├── server/idea-listing.test.ts                         # NEW
│   │   ├── server/idea-history.test.ts                         # NEW
│   │   └── server/idea-service.edit-delete.test.ts             # NEW
│   ├── integration/
│   │   ├── ideas-listing.test.ts                               # NEW (Stories 2 + 3)
│   │   ├── ideas-edit-delete.test.ts                           # NEW (Story 1)
│   │   ├── ideas-history.test.ts                               # NEW (Story 4)
│   │   └── ideas-export-csv.test.ts                            # NEW (Story 5)
│   └── e2e/
│       ├── employee-edit-own-idea.spec.ts                      # NEW (Story 1, axe-checked)
│       └── reviewer-filter-and-export.spec.ts                  # NEW (Stories 2 + 5, axe-checked)
```

**Structure Decision**: Reuse the existing single-app Next.js layout
under `src/`. No new top-level folder. The listing, history, and
export concerns are isolated into three small `src/server/` modules
so the existing `idea-service.ts` does not balloon; the same modules
are imported by both the page (RSC) and the route handler.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | _n/a_ | _n/a_ |
