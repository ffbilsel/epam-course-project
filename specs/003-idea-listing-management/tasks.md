---
description: "Task list for feature 003-idea-listing-management"
---

# Tasks: Idea Listing & Management Enhancements (Phase 3)

**Input**: Design documents from
`/specs/003-idea-listing-management/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md),
[adr/](./adr/) (0013–0016).

**Tests**: REQUIRED. The constitution (Principle III, Quality Gate 3)
mandates the testing pyramid; every task that adds business logic
ships with its tests.

**Organization**: Tasks are grouped by user story so each story can
be implemented, tested, and demoed in isolation. Five user stories
(US1 Edit/Delete P1, US2 Search/Filter P1, US3 Pagination P2, US4
History tab P2, US5 CSV Export P3). MVP = Setup + Foundational +
US1 + US2.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: parallelizable (different files, no upstream dependency)
- **[Story]**: which user story the task belongs to (US1…US5).
  Setup, Foundational, and Polish tasks carry no story label.
- Every task includes the exact file path it touches.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: small repo-wide groundwork shared by every story.

- [ ] T001 Add 6 new error codes to `src/lib/errors/codes.ts` — `IDEA_NOT_EDITABLE`, `IDEA_NOT_DELETABLE`, `IDEA_LISTING_RANGE_INVALID`, `IDEA_LISTING_PAGE_INVALID`, `IDEA_LISTING_SEARCH_TOO_LONG`, `IDEA_EXPORT_FORBIDDEN_FILTER`
- [ ] T002 [P] Add matching UI copy for those 6 codes in `src/lib/errors/error-messages.ts`
- [ ] T003 [P] Add `idea_edited` and `idea_export` to the `SecurityEvent.event` union in `src/server/infra/logger.ts`
- [ ] T004 [P] Add `tasks.md` entries for typecheck + lint scripts to a fresh `tests/unit/lib/errors/new-codes.test.ts` asserting each new code has a message (Quality Gate 9)

**Checkpoint**: shared types & codes available to every later phase.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema + shared primitives every user story needs.
**⚠️ CRITICAL**: no user-story work may start until this phase is complete.

- [ ] T005 Create migration `drizzle/0002_listing_and_edits.sql` — rewrite `status_transitions` CHECK to allow the five lifecycle states on both `from_state` and `to_state` (enables `from = to` edit markers); add composite index `idx_ideas_search` on `ideas(status, category_id, created_at)`. Snapshot at `drizzle/meta/0002_snapshot.json`
- [ ] T006 [P] Add `ListingQuerySchema`, `UpdateIdeaSchema`, and `IDEA_STATUS_VALUES` re-export to `src/lib/validation/idea.ts`
- [ ] T007 [P] Add `src/lib/validation/pagination.ts` (parsed `page` + `pageSize` with `IDEA_LISTING_PAGE_INVALID` mapping), re-used by listing + export
- [ ] T008 [P] Add pure helpers `canAuthorEdit(idea, actor)` and `canAuthorDelete(idea, actor)` to `src/server/idea-state-machine.ts`
- [ ] T009 [P] Add `src/lib/format/csv.ts` (RFC 4180 row writer)
- [ ] T010 [P] [unit-tests] Add `tests/unit/lib/format/csv.test.ts` covering: plain row, embedded comma, embedded quote, embedded CRLF, leading/trailing space, empty cell, unicode
- [ ] T011 [P] [unit-tests] Add `tests/unit/lib/validation/listing-query.test.ts` covering: defaults, `q` length limit, `from > to`, invalid date, illegal `pageSize`, repeated `status`
- [ ] T012 [P] Add re-exports of `ListingQuery`, `ListingPage`, `IdeaSummary`, `UpdateIdeaInput`, `IdeaHistoryEvent`, `IdeaExportRow` in `src/types/index.ts`

**Checkpoint**: foundation ready. User-story phases may now proceed in parallel (subject to capacity).

---

## Phase 3: User Story 1 — Edit & Delete own idea (Priority: P1) 🎯 MVP

**Goal**: an author may edit or hard-delete their own idea while it is `SUBMITTED`; controls are hidden and the API rejects mutation past that point ([ADR-0013](./adr/0013-edit-delete-cutoff.md)).

**Independent Test**: as a signed-in employee with one `SUBMITTED` and one `APPROVED` idea, the Edit/Delete controls appear only on the `SUBMITTED` one; PATCH/DELETE on the `APPROVED` one return 409 `IDEA_NOT_EDITABLE` / `IDEA_NOT_DELETABLE`.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [X] T013 [P] [US1] Unit tests for `canAuthorEdit` / `canAuthorDelete` in `tests/unit/server/idea-service.edit-delete.test.ts` — one assertion per status × (own/other) matrix
- [X] T014 [P] [US1] Integration tests in `tests/integration/ideas-edit-delete.test.ts` covering: edit own `SUBMITTED` succeeds and writes an `EDITED` audit row; edit `UNDER_REVIEW` → 409; edit other's idea → 403; delete own `SUBMITTED` cascades to answers + attachments + transitions; delete `APPROVED` → 409
- [X] T015 [P] [US1] E2E in `tests/e2e/employee-edit-own-idea.spec.ts` — sign in, edit, see updated detail, axe scan passes (Quality Gate 8)

### Implementation for User Story 1

- [X] T016 [P] [US1] Add `updateIdea(ideaId, fields)`, `hardDeleteIdea(ideaId)` to `src/db/repositories/idea-repo.ts`
- [X] T017 [P] [US1] Add `insertEditedMarker(ideaId, actorId, status, comment)` to `src/db/repositories/transition-repo.ts`
- [X] T018 [US1] Add `editIdea(ideaId, input, actor)` and `deleteIdea(ideaId, actor)` to `src/server/idea-service.ts` (transactional; emits `idea_edited` security event). Depends on T016, T017
- [X] T019 [P] [US1] Make `src/components/forms/idea-form.tsx` reusable for both create and edit (accept `defaultValues` + `mode`)
- [X] T020 [US1] Add page `src/app/(employee)/ideas/[id]/edit/page.tsx` (RSC: auth, load idea, render `IdeaForm`). Depends on T019
- [X] T021 [P] [US1] Add `src/components/ideas/edit-idea-button.tsx` (visibility gated on `canAuthorEdit`)
- [X] T022 [P] [US1] Add `src/components/ideas/delete-idea-dialog.tsx` (shadcn `Dialog`, destructive variant, confirm phrase)
- [X] T023 [US1] Wire Edit + Delete into `src/app/(employee)/ideas/[id]/page.tsx`. Depends on T021, T022
- [X] T024 [US1] Add `PATCH` + `DELETE` handlers to `src/app/api/ideas/[id]/route.ts` (Zod parse → `editIdea`/`deleteIdea` → error envelope). Depends on T018

**Checkpoint**: US1 demoable end-to-end.

---

## Phase 4: User Story 2 — Search & Filter listings (Priority: P1)

**Goal**: every listing surface (My Ideas, Review Queue, Admin all-ideas) gets a server-side filter bar — free text, single category, status set, date range — combined with AND semantics and reflected in the URL ([ADR-0014](./adr/0014-listing-query-design.md)).

**Independent Test**: `/my-ideas?status=SUBMITTED&q=coffee&from=2026-05-01` returns only matching rows; clearing the search via UI removes `q` from the URL and refetches.

### Tests for User Story 2 ⚠️

- [X] T025 [P] [US2] Unit tests `tests/unit/server/idea-listing.test.ts` for `buildListingQuery` — every filter combination, per-role scope rules
- [X] T026 [P] [US2] Integration tests `tests/integration/ideas-listing.test.ts` — employee scope hides others' rows; reviewer scope returns only SUBMITTED+UNDER_REVIEW; admin scope unrestricted; AND semantics; `q` is case-insensitive; date range inclusive
- [ ] T027 [P] [US2] E2E `tests/e2e/reviewer-filter-and-export.spec.ts` (filter half, axe pass)

### Implementation for User Story 2

- [X] T028 [P] [US2] Add `listFiltered(query, scope)` + `countFiltered(query, scope)` to `src/db/repositories/idea-repo.ts`
- [X] T029 [P] [US2] Add `src/server/idea-listing.ts` exposing `runListingQuery(query, session)` returning `ListingPage<IdeaSummary>` (applies per-role scope, joins categories + authors)
- [X] T030 [P] [US2] Add `src/lib/hooks/use-listing-query.ts` (URL-state hook, debounced `q`)
- [X] T031 [P] [US2] Add `src/components/ideas/idea-filter-bar.tsx` (search input + category select + status chips + date range; mobile accordion below `sm:`)
- [X] T032 [US2] Update `GET` handler in `src/app/api/ideas/route.ts` to parse `ListingQuerySchema` and delegate to `runListingQuery`. Depends on T029
- [X] T033 [US2] Wire filter bar into `src/app/(employee)/my-ideas/page.tsx`. Depends on T031, T032
- [X] T034 [US2] Wire filter bar into `src/app/(reviewer)/queue/page.tsx`. Depends on T031, T032
- [X] T035 [US2] Add `src/app/(admin)/admin/ideas/page.tsx` (admin all-ideas listing using same filter bar). Depends on T031, T032

**Checkpoint**: MVP slice (US1 + US2) demoable end-to-end.

---

## Phase 5: User Story 3 — Pagination (Priority: P2)

**Goal**: every listing surface paginates with page size 20/50/100 and a total count, URL-bound, clamping out-of-range pages.

**Independent Test**: with 73 seeded ideas, default pageSize=20 yields 4 pages; `?page=99` clamps to last page; `?pageSize=37` returns 400 `IDEA_LISTING_PAGE_INVALID`.

### Tests for User Story 3 ⚠️

- [X] T036 [P] [US3] Extend `tests/integration/ideas-listing.test.ts` with pagination cases (defaults, clamp on overflow, illegal `pageSize`, `totalPages` math, stable order with ties)

### Implementation for User Story 3

- [X] T037 [P] [US3] Add `src/components/ideas/idea-pagination.tsx` (prev/next, numeric pages, page-size select; URL-bound)
- [X] T038 [US3] Wire pagination into the three listing pages — `src/app/(employee)/my-ideas/page.tsx`, `src/app/(reviewer)/queue/page.tsx`, `src/app/(admin)/admin/ideas/page.tsx`. Depends on T037

**Checkpoint**: US3 complete; listings show totals and respect page size.

---

## Phase 6: User Story 4 — History tab on idea detail (Priority: P2)

**Goal**: a per-idea History tab shows submission, every author edit, and every reviewer transition as a single chronological feed ([ADR-0015](./adr/0015-edited-audit-row.md)).

**Independent Test**: on a seeded idea with one edit and two transitions, the History tab shows 4 rows in order: SUBMITTED → EDITED → TRANSITION → TRANSITION.

### Tests for User Story 4 ⚠️

- [ ] T039 [P] [US4] Unit tests `tests/unit/server/idea-history.test.ts` for `getIdeaHistory` — empty (still emits SUBMITTED), edit-only, transition-only, mixed; ordering stable; classification by `from = to`
- [X] T040 [P] [US4] Integration tests `tests/integration/ideas-history.test.ts` — author can read own history; reviewer can read queue-scope history; unrelated employee → 403; admin reads any

### Implementation for User Story 4

- [X] T041 [P] [US4] Add `src/server/idea-history.ts` (`getIdeaHistory(ideaId, actor)` → `IdeaHistoryEvent[]`)
- [X] T042 [P] [US4] Add `src/components/ideas/idea-history-tab.tsx` (renders the three event kinds; empty/loading/error states; relative-time tooltips)
- [X] T043 [US4] Add `GET` handler `src/app/api/ideas/[id]/history/route.ts`. Depends on T041
- [X] T044 [US4] Add History tab to `src/app/(employee)/ideas/[id]/page.tsx` using shadcn `Tabs`. Depends on T042

**Checkpoint**: US4 complete; every meaningful event is visible to the right roles.

---

## Phase 7: User Story 5 — Admin CSV export (Priority: P3)

**Goal**: an admin can export the current filter set to a streamed RFC-4180 CSV ([ADR-0016](./adr/0016-csv-export-streaming.md)). The action is recorded as a `security` event of kind `idea_export`.

**Independent Test**: as admin, with a filter pinned to `status=APPROVED&categoryId=<x>`, click "Export CSV" — file contains the expected header row, every approved idea in that category, and nothing else; security log has one `idea_export` row with the filter snapshot and row count.

### Tests for User Story 5 ⚠️

- [X] T045 [P] [US5] Integration tests `tests/integration/ideas-export-csv.test.ts` — non-admin → 403; filter respected; row count matches listing total; quoting on title with commas/quotes/newlines; security event written
- [ ] T046 [P] [US5] Extend E2E `tests/e2e/reviewer-filter-and-export.spec.ts` (export half) — download triggers, file parses, axe pass

### Implementation for User Story 5

- [X] T047 [P] [US5] Add `src/server/idea-export.ts` — `streamIdeasCsv(query, session)` returns a `ReadableStream<Uint8Array>` pulled in batches of 500 rows; logs `idea_export`. Depends on T029 (reuses listing predicate)
- [X] T048 [P] [US5] Add `src/components/admin/export-ideas-button.tsx` (preserves current URL filters in the export href)
- [X] T049 [US5] Add `GET` handler `src/app/api/ideas/export/route.ts` (admin-only role guard, sets `Content-Disposition`, returns the stream). Depends on T047
- [X] T050 [US5] Wire the button into `src/app/(admin)/admin/ideas/page.tsx`. Depends on T048

**Checkpoint**: all five stories independently functional.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T051 [P] Update `README.md` and `PROJECT_SUMMARY.md` with Phase-3 capabilities
- [X] T052 [P] Update `scripts/seed-demo.ts` to seed two edited ideas + one cross-status mix so demo data exercises all listing filters
- [X] T053 [P] Run `npm run check:error-codes` and `npm run check:ui-tokens`; fix any drift
- [ ] T054 Run quickstart walkthrough end-to-end ([./quickstart.md](./quickstart.md)) and tick SC-001…SC-006
- [X] T055 Run full pipeline: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run format -- --check`
- [ ] T056 Merge feature branch back to `main` with `git merge --no-ff 003-idea-listing-management` (Constitution Principle X / Quality Gate 12)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no upstream dependency — start immediately.
- **Foundational (Phase 2)**: depends on Phase 1. **Blocks every user story.**
- **US1 (Phase 3)** and **US2 (Phase 4)**: depend on Phase 2; mutually independent (different files).
- **US3 (Phase 5)**: depends on Phase 2; conceptually layers onto US2 listings but the integration tests in T036 only exercise pagination math, so it can be authored in parallel with US2.
- **US4 (Phase 6)**: depends on Phase 2; consumes the `EDITED` audit rows written by US1 in real-world demos but its tests seed their own rows, so it can run in parallel.
- **US5 (Phase 7)**: depends on T029 (US2's `runListingQuery`); otherwise independent.
- **Polish (Phase 8)**: depends on every chosen story being complete.

### Within Each User Story

- Tests are written first and must fail before the implementation tasks begin (Constitution V).
- Repositories → services → route handlers → pages.
- Add JSDoc on every export (Quality Gate 5).

### Parallel Opportunities

- Phase 1: T002, T003, T004 in parallel after T001.
- Phase 2: T006–T012 fully parallel; only T005 (migration) blocks the rest indirectly via the test DB.
- Phase 3: T013, T014, T015 in parallel; T016 ∥ T017 ∥ T019 ∥ T021 ∥ T022 in parallel; T018 waits on T016+T017; T020 waits on T019; T023 waits on T021+T022; T024 waits on T018.
- Phase 4: T025, T026, T027 (filter half) in parallel; T028 ∥ T029 ∥ T030 ∥ T031 in parallel; T032 waits on T029; T033/T034/T035 wait on T031+T032.
- Phase 5: T036 in parallel; T037 in parallel; T038 waits on T037.
- Phase 6: T039 ∥ T040 in parallel; T041 ∥ T042 in parallel; T043 waits on T041; T044 waits on T042.
- Phase 7: T045 ∥ T046 (export half) in parallel; T047 ∥ T048 in parallel; T049 waits on T047; T050 waits on T048.
- Phase 8: T051, T052, T053 in parallel; then T054 → T055 → T056 sequential.

---

## Implementation Strategy

1. **MVP (Setup → Foundational → US1 → US2)** — delivers edit/delete on own ideas plus server-side search & filter, which is the immediate quality-of-life win this feature was scoped around. Ship and demo at this point.
2. **+ Pagination (US3)** — single small UI component plus three wires; ship next.
3. **+ History (US4)** — independent feature on the detail page; ship when ready.
4. **+ CSV export (US5)** — admin polish; ship last.
5. **Polish** — docs, demo data, gates, merge-back to `main` with `--no-ff`.

---

## Task count summary

- Setup: 4 (T001–T004)
- Foundational: 8 (T005–T012)
- US1 Edit & Delete: 12 (T013–T024)
- US2 Search & Filter: 11 (T025–T035)
- US3 Pagination: 3 (T036–T038)
- US4 History tab: 6 (T039–T044)
- US5 CSV Export: 6 (T045–T050)
- Polish & merge: 6 (T051–T056)
- **Total: 56 tasks** across 5 user stories.
