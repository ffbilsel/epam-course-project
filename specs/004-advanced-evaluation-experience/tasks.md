---
description: "Task list for feature 004-advanced-evaluation-experience"
---

# Tasks: Advanced Evaluation Experience (Phase 4)

**Input**: Design documents from
`/specs/004-advanced-evaluation-experience/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md),
[adr/](./adr/) (0017–0022).

**Tests**: REQUIRED. The constitution (Principle III, Quality Gate 3)
mandates the testing pyramid; every task that adds business logic
ships with its tests.

**Organization**: Tasks are grouped by user story so each story can
be implemented, tested, and demoed in isolation. Five user stories
(US1 Drafts P1, US2 Ratings + Comments P1, US3 Anonymous Evaluation
P2, US4 Insights P2, US5 Frontend Makeover P2) plus a Hardening
phase covering FR-037 (Employee dashboard History tab) and FR-038
(Reviewer review-queue status filter). MVP = Setup + Foundational +
US1 + US2.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: parallelizable (different files, no upstream dependency)
- **[Story]**: which user story the task belongs to (US1…US5) or
  **[H]** for the Hardening phase. Setup, Foundational, and Polish
  tasks carry no story label.
- Every task includes the exact file path it touches.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: small repo-wide groundwork shared by every story.

- [X] T001 Add 13 new error codes to `src/lib/errors/codes.ts` — `DRAFT_NOT_FOUND`, `DRAFT_FORBIDDEN`, `DRAFT_VALIDATION`, `RATING_INVALID_SCORE`, `RATING_REQUIRED_MISSING`, `RATING_LOCKED`, `COMMENT_NOT_FOUND`, `COMMENT_FORBIDDEN`, `COMMENT_TOO_LONG`, `COMMENT_NESTING_EXCEEDED`, `COMMENT_EDIT_WINDOW_EXPIRED`, `INSIGHTS_FORBIDDEN`, `INSIGHTS_RANGE_INVALID`
- [X] T002 [P] Add matching UI copy for those 13 codes in `src/lib/errors/error-messages.ts`
- [X] T003 [P] Extend `SecurityEvent.event` union in `src/server/infra/logger.ts` with `draft_submitted`, `rating_locked`, `comment_moderated`, `anonymity_overridden`, `insights_viewed`
- [X] T004 [P] Add `tests/unit/lib/errors/new-codes-004.test.ts` asserting each new code has a UI message (Quality Gate 9)
- [X] T005 [P] Add `recharts ^2.12` runtime dependency to `package.json` (and lockfile) per [ADR-0021](./adr/0021-recharts-as-chart-engine.md)

**Checkpoint**: shared types, codes, and the chart engine are wired in.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema, design tokens, and shared primitives every user
story needs.
**⚠️ CRITICAL**: no user-story work may start until this phase is
complete.

- [X] T006 Create migration `drizzle/0003_drafts_ratings_comments.sql` — new tables `idea_drafts`, `rating_dimensions`, `ratings`, `comments`; new columns `categories.anonymous_default`, `ideas.anonymous`; composite indexes `idx_ratings_idea`, `idx_comments_idea_created`, `idx_drafts_author_updated`, `idx_ideas_status_created`; seed the default rating dimension set (Feasibility, Impact, Originality, Alignment) with `categoryId = NULL`. Snapshot at `drizzle/meta/0003_snapshot.json`
- [X] T007 [P] Mirror the migration in Drizzle schemas — `src/db/schema/drafts.ts`, `src/db/schema/rating-dimensions.ts`, `src/db/schema/ratings.ts`, `src/db/schema/comments.ts`; extend `src/db/schema/categories.ts` and `src/db/schema/ideas.ts` with the new columns; re-export from `src/db/schema/index.ts`
- [X] T008 [P] Add `src/styles/tokens.css` (light + dark CSS-variable design tokens per [ADR-0022](./adr/0022-makeover-design-tokens.md)) and import it from `src/app/globals.css`
- [X] T009 [P] Add `src/lib/format/plain-text.ts` exporting `escapeAndLinebreak(input: string)` (HTML-escape + `\n → <br>`, NFR-007)
- [X] T010 [P] [unit-tests] `tests/unit/lib/format/plain-text.test.ts` — empty, plain, embedded `<`, `>`, `&`, `"`, `'`, single LF, CRLF, mixed, unicode emoji
- [X] T011 [P] Add `src/lib/validation/draft.ts` with `SaveDraftSchema` (all fields optional) and `SubmitDraftSchema` (delegates to feature-002 idea-submit schema)
- [X] T012 [P] Add `src/lib/validation/rating.ts` with `RatingPutSchema` (per-dimension `score: z.union([z.literal(null), z.number().int().min(1).max(5)])`) and `RATING_SCORE_VALUES`
- [X] T013 [P] Add `src/lib/validation/comment.ts` with `CommentPostSchema` (body ≤ 2 000 chars, plain text) and `CommentEditSchema`
- [X] T014 [P] Add `src/lib/validation/insights.ts` with `InsightsRangeSchema` (preset enum + custom from/to + bucket: day|week|month)
- [X] T015 [P] Add pure `src/server/anonymity.ts` exporting `maskAuthor(idea, viewer)` and `maskHistoryEvent(event, viewer)` — JSDoc `@example` per Principle IV; idempotent and side-effect-free
- [X] T016 [P] [unit-tests] `tests/unit/server/anonymity.test.ts` — every (viewerRole × idea.anonymous × authorRole) cell of the truth table; one assertion per case via `it.each`
- [X] T017 [P] [unit-tests] `tests/unit/lib/validation/rating.test.ts` and `tests/unit/lib/validation/comment.test.ts` — boundary 1/5, 0 rejects, 6 rejects, `null` accepted, oversize body rejects, plain LF preserved
- [X] T018 [P] Re-export `Draft`, `RatingDimension`, `Rating`, `Comment`, `InsightsRange`, `InsightsBucket`, `InsightsSeries` in `src/types/index.ts`
- [X] T019 [P] Add `src/components/layout/app-shell.tsx`, `src/components/layout/sidebar.tsx`, and `src/components/layout/theme-toggle.tsx` — shared chrome per [ADR-0022](./adr/0022-makeover-design-tokens.md); add `src/lib/hooks/use-theme.ts`
- [X] T020 [P] Wire `AppShell` into `src/app/layout.tsx` (root) and the three role-scoped layouts under `src/app/(employee)/layout.tsx`, `src/app/(reviewer)/layout.tsx`, `src/app/(admin)/layout.tsx`

**Checkpoint**: schema, design tokens, validators, anonymity helper, and `AppShell` are ready. User-story phases may now proceed in parallel (subject to capacity).

---

## Phase 3: User Story 1 — Save and edit drafts before submitting (Priority: P1) 🎯 MVP

**Goal**: an Employee can save, edit, list, submit, and delete their
own drafts; drafts are strictly private and never enter any aggregate
([ADR-0017](./adr/0017-drafts-separate-table.md)).

**Independent Test**: as an Employee, save a partial idea → close
browser → reopen "My Drafts" → edit → submit; the new idea appears in
the reviewer queue in `SUBMITTED`, the draft disappears, and no other
role can list or fetch the draft.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [ ] T021 [P] [US1] `tests/unit/server/draft-service.test.ts` — create/update/delete/submit happy paths; `DRAFT_FORBIDDEN` when actor ≠ author; `DRAFT_VALIDATION` propagated from submit; idempotent update
- [ ] T022 [P] [US1] `tests/integration/drafts-lifecycle.test.ts` — author-only visibility (reviewer/admin GETs return 404); submit creates an `ideas` row in `SUBMITTED` and removes the draft in a single transaction; deleting a draft cascades to its draft-only attachments
- [ ] T023 [P] [US1] `tests/e2e/employee-save-and-submit-draft.spec.ts` (Playwright + axe) — save → reopen → edit → submit → reviewer queue contains the idea

### Implementation for User Story 1

- [ ] T024 [P] [US1] `src/db/repositories/draft-repo.ts` — `createDraft`, `updateDraft`, `getDraft`, `listDraftsByAuthor`, `deleteDraft`
- [ ] T025 [US1] `src/server/draft-service.ts` — `saveDraft`, `loadDraft`, `listMyDrafts`, `deleteDraft`, `submitDraft`; `submitDraft` runs feature-002 validators, snapshots `categories.anonymous_default` into the new `ideas.anonymous` column (ADR-0018), and emits `draft_submitted` audit. Depends on T024
- [ ] T026 [P] [US1] `src/lib/hooks/use-draft-autosave.ts` — debounced PUT (300 ms) with last-write-wins and "Saved · just now" status
- [ ] T027 [P] [US1] `src/components/drafts/save-draft-button.tsx`, `src/components/drafts/draft-list.tsx`, `src/components/drafts/draft-editor.tsx` (wraps the feature-002 smart form and the autosave hook)
- [ ] T028 [US1] Page `src/app/(employee)/drafts/page.tsx` (RSC: auth, list author drafts, empty/loading/error states). Depends on T027
- [ ] T029 [US1] Page `src/app/(employee)/drafts/[id]/page.tsx` (RSC: auth, ownership check, render `DraftEditor`). Depends on T027
- [ ] T030 [US1] Add "Save draft" affordance to `src/app/(employee)/ideas/new/page.tsx`. Depends on T027
- [ ] T031 [US1] API `src/app/api/drafts/route.ts` — `POST` create, `GET` list (author scope only). Depends on T025
- [ ] T032 [US1] API `src/app/api/drafts/[id]/route.ts` — `GET`, `PUT` update, `DELETE`, `POST /submit`. Depends on T025
- [ ] T033 [US1] Sidebar entry "My Drafts" with badge count in `src/components/layout/sidebar.tsx` (Employee role only). Depends on T019, T031

**Checkpoint**: US1 demoable end-to-end; drafts are invisible to every other role.

---

## Phase 4: User Story 2 — Multi-dimensional ratings + comment threads (Priority: P1)

**Goal**: Reviewers record per-dimension 1–5 scores and discuss the
idea in a one-level nested comment thread; required dimensions gate
the decision; scores lock on Approve/Reject; the decision comment
posts into the thread as `kind = 'DECISION'`
([ADR-0019](./adr/0019-ratings-schema.md),
[ADR-0020](./adr/0020-comment-thread-shape.md)).

**Independent Test**: as a Reviewer with one `UNDER_REVIEW` idea
whose category has one required dimension, scoring all dimensions and
posting a comment succeeds; trying to Approve with the required
dimension unrated returns 422 `RATING_REQUIRED_MISSING` and the state
does not change; after Approve, all of that reviewer's rating rows
have a non-null `lockedAt` and the decision comment exists in the
thread.

### Tests for User Story 2 ⚠️

- [ ] T034 [P] [US2] `tests/unit/server/rating-service.test.ts` — set/update/clear score; lock on decision; `RATING_INVALID_SCORE` for 0/6; `RATING_LOCKED` after decision; cross-evaluator scores untouched
- [ ] T035 [P] [US2] `tests/unit/server/comment-service.test.ts` — post top-level, post reply (one level), reject reply-to-reply with `COMMENT_NESTING_EXCEEDED`; edit-within-5-min ok, after window `COMMENT_EDIT_WINDOW_EXPIRED`; soft-delete by author vs. moderator
- [ ] T036 [P] [US2] `tests/integration/ratings-record-and-lock.test.ts` — Approve blocked by missing required dimension; once satisfied, transition fires, decision comment is inserted with `kind = 'DECISION'`, and all deciding reviewer's ratings receive `lockedAt`
- [ ] T037 [P] [US2] `tests/integration/comments-thread.test.ts` — author + assigned reviewers + admins can read/post; unrelated employee → 403; soft-deleted comment renders the moderator-removed placeholder; rendered HTML never contains injected scripts
- [ ] T038 [P] [US2] `tests/e2e/reviewer-rate-and-comment.spec.ts` (Playwright + axe) — open idea → score → comment → submitter replies → reviewer approves → axe passes

### Implementation for User Story 2

- [ ] T039 [P] [US2] `src/db/repositories/dimension-repo.ts` — list per-category dimensions falling back to the default set; admin CRUD
- [ ] T040 [P] [US2] `src/db/repositories/rating-repo.ts` — `upsertRating`, `listRatingsForIdea`, `lockRatingsForDeciding`
- [ ] T041 [P] [US2] `src/db/repositories/comment-repo.ts` — `insertComment`, `softDeleteComment`, `editComment`, `listForIdea` (chronological, threads parent → replies)
- [ ] T042 [US2] `src/server/rating-service.ts` — `getRatings`, `putRatings(ideaId, evaluatorId, scores)`, `requireRequiredDimensions(idea, evaluatorId)`, `lockOnDecision(ideaId, evaluatorId)`. Depends on T039, T040
- [ ] T043 [US2] `src/server/comment-service.ts` — `postComment`, `editComment`, `deleteComment`, `listThread`; enforces one-level nesting and 5-minute edit window; emits `comment_moderated` audit on moderator deletes. Depends on T041
- [ ] T044 [US2] Wire `src/server/idea-service.ts` — Approve/Reject transitions now call `requireRequiredDimensions`, `lockOnDecision`, and `postComment({ kind: 'DECISION' })` in the same transaction. Depends on T042, T043
- [ ] T045 [P] [US2] `src/components/ratings/rating-panel.tsx` — per-dimension 1–5 selector with explicit "unrated" state, tooltips from dimension descriptions, mobile-stacked grid
- [ ] T046 [P] [US2] `src/components/ratings/rating-summary.tsx` — post-decision read-only view with attribution per evaluator
- [ ] T047 [P] [US2] `src/components/comments/comment-thread.tsx`, `comment-item.tsx`, `comment-composer.tsx` — render through `escapeAndLinebreak`, one-level nesting, soft-delete placeholder, sticky composer on mobile
- [ ] T048 [US2] API `src/app/api/ideas/[id]/ratings/route.ts` — `GET`, `PUT`. Depends on T042
- [ ] T049 [US2] API `src/app/api/ideas/[id]/comments/route.ts` — `GET`, `POST`; `src/app/api/ideas/[id]/comments/[commentId]/route.ts` — `PATCH`, `DELETE`. Depends on T043
- [ ] T050 [P] [US2] Admin page `src/app/(admin)/categories/[id]/page.tsx` extended with `src/components/admin/rating-dimensions-editor.tsx` and API `src/app/api/categories/[id]/dimensions/route.ts`
- [ ] T051 [US2] Idea detail `src/app/(employee)/ideas/[id]/page.tsx` (and the reviewer variant) renders `RatingPanel` (gated on session role) and `CommentThread`. Depends on T045, T047

**Checkpoint**: MVP slice (US1 + US2) demoable end-to-end.

---

## Phase 5: User Story 3 — Anonymous evaluation (Priority: P2)

**Goal**: anonymity is a snapshot on the idea, taken from the
category default at submit time and overridable per-idea by Admins;
every Reviewer read path masks the submitter; Submitters and Admins
always see real identities; reviewer identity is never masked
([ADR-0018](./adr/0018-anonymity-model.md)).

**Independent Test**: an idea in a category whose
`anonymous_default = 1` is anonymous to a Reviewer (queue row,
detail page, history tab, comment thread, ratings panel) and not
anonymous to the Submitter or to an Admin; an Admin per-idea toggle
flips the projection on the very next request (SC-005).

### Tests for User Story 3 ⚠️

- [ ] T052 [P] [US3] `tests/integration/anonymity-projection.test.ts` — exhaustive contract test, one case per Reviewer-facing endpoint (queue list, idea detail, history, ratings GET, comments GET, insights tooltips). Asserts response body contains **no** `authorName`, `authorEmail`, `authorId`, `authorAvatarUrl` for anonymous ideas viewed by a Reviewer; full identity for Submitter and Admin (SC-005)

### Implementation for User Story 3

- [ ] T053 [US3] Apply `maskAuthor` to `src/server/idea-listing.ts` so every listing surface (Employee, Reviewer, Admin) emits the masked projection per viewer
- [ ] T054 [US3] Apply `maskAuthor` to the idea detail server loader used by `src/app/(employee)/ideas/[id]/page.tsx` and the reviewer variant
- [ ] T055 [US3] Apply `maskAuthor` inside `comment-service.ts` `listThread` and `rating-service.ts` `getRatings` so author identity returned over the API is already masked
- [ ] T056 [US3] Apply `maskHistoryEvent` to `src/server/idea-history.ts` from feature 003 so `SUBMITTED` / `EDITED` events render "Anonymous Submitter" for Reviewers but stay intact for the author and Admin
- [ ] T057 [P] [US3] Surface anonymous default toggle on `src/components/admin/rating-dimensions-editor.tsx`-adjacent category form (`anonymous_default`)
- [ ] T058 [P] [US3] Admin per-idea anonymity override control in the idea detail page (Admin only) with `PATCH /api/ideas/[id]` extended to accept `{ anonymous: boolean }`; emit `anonymity_overridden` audit
- [ ] T059 [P] [US3] Add author-panel UI component `src/components/ideas/author-pill.tsx` that consumes the masked projection — never reads `session` directly

**Checkpoint**: US3 contract-tested; SC-005 passes; reviewer-facing surfaces leak nothing.

---

## Phase 6: User Story 4 — Insight dashboards (Priority: P2)

**Goal**: three Recharts-rendered charts (Submission Trend, Approval
Rate, Category Distribution) computed by three pure aggregator
endpoints; ADMIN gets full data, EVALUATOR gets aggregate-only,
EMPLOYEE is forbidden ([ADR-0021](./adr/0021-recharts-as-chart-engine.md)).

**Independent Test**: with a 1 000-idea seed (~250 decided), the
Admin Insights page renders all three charts in under 2 s on a cold
load, switching range from "last 30 days" to "current quarter" re-
renders consistently, EVALUATOR sees no per-submitter detail, and
EMPLOYEE access is forbidden (FR-025, FR-031, NFR-001, SC-006).

### Tests for User Story 4 ⚠️

- [ ] T060 [P] [US4] `tests/unit/server/insights-service.test.ts` — bucket math (day/week/month) on a deterministic 60-day window; approval-rate formula on hand-picked status mixes; category-distribution sums to 100 %; empty-range emits the explicit empty payload (FR-030); EVALUATOR scope omits any submitter-identifying field
- [ ] T061 [P] [US4] `tests/integration/insights-endpoints.test.ts` — ADMIN gets all three endpoints; EVALUATOR gets restricted variants; EMPLOYEE gets 403 `INSIGHTS_FORBIDDEN`; `InsightsRangeSchema` rejects `from > to` with `INSIGHTS_RANGE_INVALID`

### Implementation for User Story 4

- [ ] T062 [P] [US4] `src/db/repositories/insights-repo.ts` — three covering queries against `ideas` + `status_transitions` using the new `idx_ideas_status_created` index
- [ ] T063 [US4] `src/server/insights-service.ts` — `getSubmissionTrend`, `getApprovalRate`, `getCategoryDistribution`; each is a pure function over the repo + range; applies role-scope (EVALUATOR-restricted projection). Depends on T062
- [ ] T064 [P] [US4] `src/components/insights/charts/submission-trend-chart.tsx` (Recharts `AreaChart`), `approval-rate-chart.tsx` (`ComposedChart`), `category-distribution-chart.tsx` (`BarChart`) — Tailwind-token themed, hover tooltip with exact numbers, empty-state panel
- [ ] T065 [P] [US4] `src/components/insights/range-picker.tsx` — presets (7d / 30d / quarter / year / custom) + URL-bound state
- [ ] T066 [US4] `src/components/insights/insights-page.tsx` — wraps `RangePicker` + three charts, parallel `Promise.all` fetch, per-chart loading skeleton. Depends on T064, T065
- [ ] T067 [US4] API `src/app/api/insights/trend/route.ts`, `src/app/api/insights/approval-rate/route.ts`, `src/app/api/insights/category-distribution/route.ts` — role-guarded, parses `InsightsRangeSchema`, emits `insights_viewed` audit. Depends on T063
- [ ] T068 [US4] Admin page `src/app/(admin)/insights/page.tsx` and reviewer page `src/app/(reviewer)/insights/page.tsx` (restricted view). Depends on T066

**Checkpoint**: US4 complete; charts honour anonymity (US3) and the role-scope rule.

---

## Phase 7: User Story 5 — Frontend makeover (Priority: P2)

**Goal**: every authenticated surface uses the
`src/styles/tokens.css` design system, a working dark mode, and the
shared `AppShell`; no legacy one-off styles survive from features
001–003 ([ADR-0022](./adr/0022-makeover-design-tokens.md)).

**Independent Test**: navigate sign-in → home → new-idea → drafts →
detail → my-ideas → queue → admin/categories → insights; every page
renders identical typography, spacing, controls, and empty states;
dark-mode toggle flips theme without a flash; axe scan reports no
new WCAG AA contrast violations (SC-008).

### Tests for User Story 5 ⚠️

- [ ] T069 [P] [US5] `tests/e2e/admin-insights-and-dark-mode.spec.ts` (Playwright + axe) — toggle dark mode on every primary route, axe scan each
- [ ] T070 [P] [US5] Extend `scripts/check-ui-tokens.ts` to fail on any hard-coded hex/`rgb()`/inline-style colour in `src/components/**` and `src/app/**` (excludes `src/components/ui/**` shadcn primitives and the new `src/components/insights/charts/**`)

### Implementation for User Story 5

- [ ] T071 [P] [US5] Re-skin every page touched by features 001–003 to consume `tokens.css` only — `src/app/page.tsx`, `src/app/(employee)/my-ideas/page.tsx`, `src/app/(employee)/ideas/new/page.tsx`, `src/app/(employee)/ideas/[id]/page.tsx`, `src/app/(reviewer)/queue/page.tsx`, `src/app/(admin)/admin/ideas/page.tsx`, `src/app/(admin)/categories/page.tsx`
- [ ] T072 [P] [US5] Normalise shadcn primitive variants in `src/components/ui/*` to use only token-backed CSS variables (no hex literals)
- [ ] T073 [P] [US5] Audit and remove ad-hoc page chrome (`<header>` / `<nav>` blocks) from feature 001–003 pages now provided by `AppShell` (T020)
- [ ] T074 [P] [US5] Add `prefers-reduced-motion` guard to every transition/animation in `tokens.css` and `src/components/**` (NFR-005)
- [ ] T075 [US5] Manual responsive walkthrough at 360 px / 768 px / 1280 px on each re-skinned page; fix overflow/wrap issues

**Checkpoint**: all five stories independently functional and visually consistent.

---

## Phase 8: Hardening — FR-037 (Employee History tab) + FR-038 (queue status filter)

**Purpose**: close the two known holes in feature 003 surfaces that
must ship with Phase 4.

### Tests for Hardening ⚠️

- [ ] T076 [P] [H] `tests/integration/employee-history-tab.test.ts` — Employee sees their own `APPROVED`, `REJECTED`, `IMPLEMENTED` ideas in History; never sees `DRAFT`, `SUBMITTED`, or `UNDER_REVIEW`; never sees another author's history; FR-037 fields present (title, category, concluded date, final decision); links resolve to the idea detail page
- [ ] T077 [P] [H] `tests/integration/queue-status-filter.test.ts` — full FR-038 matrix: selectable statuses match the queue surface; "no selection" → no status filter (not "no results"); selection is URL-bound and survives reload; status ∩ category ∩ search produces logical intersection; the two empty-states ("queue empty" vs. "no matches") render distinct copy
- [ ] T078 [P] [H] `tests/e2e/reviewer-queue-status-filter.spec.ts` (Playwright + axe) — verifies the URL round-trip and the two empty-state messages

### Implementation for Hardening

- [ ] T079 [H] Extend `src/server/idea-listing.ts` with a `concludedOnly` predicate (status ∈ {APPROVED, REJECTED, IMPLEMENTED} ∧ authorId = viewer) and a typed `EmployeeHistoryRow` projection (title, category, concludedAt, decision). Depends on T053 (anonymity projection)
- [ ] T080 [P] [H] `src/components/dashboard/history-tab.tsx` — list, empty/loading/error states, links to `/ideas/[id]`
- [ ] T081 [H] Add the History tab to `src/app/(employee)/dashboard/page.tsx` (shadcn `Tabs`: "Active" + "History"). Depends on T079, T080
- [ ] T082 [H] Fix `src/components/ideas/idea-filter-bar.tsx`: restrict the status set to the queue surface (`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `IMPLEMENTED`); treat empty selection as "no filter" (omit `status` from the URL entirely); show distinct empty-state copy for "queue empty" vs. "no matches"
- [ ] T083 [H] Tighten `ListingQuerySchema` in `src/lib/validation/idea.ts` so an empty `status` array round-trips as "no filter" and is removed from the parsed query (not coerced to "no results"); rename `IDEA_LISTING_RANGE_INVALID` mapping if needed
- [ ] T084 [H] Wire the corrected filter bar into `src/app/(reviewer)/queue/page.tsx` and ensure the URL serialiser drops empty `status`. Depends on T082, T083

**Checkpoint**: FR-037 and FR-038 are closed and regression-tested.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T085 [P] Update `README.md` and `PROJECT_SUMMARY.md` with Phase-4 capabilities (Drafts, Ratings, Comments, Anonymity, Insights, Makeover, Hardening)
- [ ] T086 [P] Update `scripts/seed-demo.ts` to seed: 5 drafts on one Employee, 20 ideas spanning every status, 1 anonymous category, 200 ratings, 80 comments (incl. replies and 1 soft-deleted), 1 concluded idea per terminal status for the History tab
- [ ] T087 [P] Run `npm run check:error-codes` and `npm run check:ui-tokens`; fix any drift
- [ ] T088 [P] Add JSDoc on every new export and run the JSDoc lint (Quality Gate 5)
- [ ] T089 Run quickstart walkthrough end-to-end ([./quickstart.md](./quickstart.md)) and tick SC-001…SC-009
- [ ] T090 Run full pipeline: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run format -- --check`
- [ ] T091 Merge feature branch back to `main` with `git merge --no-ff 004-advanced-evaluation-experience` (Constitution Principle X / Quality Gate 12)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no upstream dependency — start immediately.
- **Foundational (Phase 2)**: depends on Phase 1. **Blocks every user story.**
- **US1 (Phase 3)** and **US2 (Phase 4)**: depend on Phase 2; mutually independent (different files).
- **US3 (Phase 5)**: depends on Phase 2 (anonymity helper T015) and on US1 + US2 read paths existing in some form; can run in parallel with the *implementation* of US1/US2 once their service signatures are stable.
- **US4 (Phase 6)**: depends on Phase 2 (schema + validators); independent of US1/US2 implementation but consumes the anonymity rule from US3 in its tooltips, so its endpoints land after T053–T055.
- **US5 (Phase 7)**: depends on Phase 2 (T008 tokens, T019 AppShell) and ideally on the new pages from US1/US2/US4 existing so they can be re-skinned in one pass.
- **Hardening (Phase 8)**: depends on Phase 2 (validators) and on T053 (anonymity in listing); otherwise independent.
- **Polish (Phase 9)**: depends on every chosen story plus Hardening being complete.

### Within Each User Story

- Tests are written first and must fail before implementation begins (Constitution V).
- Repositories → services → route handlers → pages.
- Add JSDoc on every export (Quality Gate 5).

### Parallel Opportunities

- Phase 1: T002, T003, T004, T005 in parallel after T001.
- Phase 2: T007–T018 fully parallel after T006 lands; T019 ∥ T020 (T020 depends on T019).
- Phase 3: T021, T022, T023 in parallel; T024 ∥ T026 ∥ T027 in parallel; T025 waits on T024; T028 / T029 / T030 wait on T027; T031 / T032 wait on T025; T033 waits on T019 + T031.
- Phase 4: T034–T038 in parallel; T039 ∥ T040 ∥ T041 in parallel; T042 waits on T039+T040; T043 waits on T041; T044 waits on T042+T043; T045 ∥ T046 ∥ T047 ∥ T050 in parallel; T048 waits on T042; T049 waits on T043; T051 waits on T045+T047.
- Phase 5: T052 in parallel with the rest; T053–T056 sequential per their files; T057 ∥ T058 ∥ T059 in parallel.
- Phase 6: T060 ∥ T061 in parallel; T062 first; T063 waits on T062; T064 ∥ T065 in parallel; T066 waits on T064+T065; T067 waits on T063; T068 waits on T066.
- Phase 7: T069 ∥ T070 in parallel; T071 ∥ T072 ∥ T073 ∥ T074 in parallel; T075 sequential at the end.
- Phase 8: T076 ∥ T077 ∥ T078 in parallel; T079 first; T080 in parallel with T079; T081 waits on T079+T080; T082 ∥ T083 in parallel; T084 waits on T082+T083.
- Phase 9: T085, T086, T087, T088 in parallel; then T089 → T090 → T091 sequential.

---

## Implementation Strategy

1. **MVP (Setup → Foundational → US1 → US2)** — drafts plus the multi-dimensional rating and comment-thread surface deliver the bulk of the user-visible value. Ship and demo at this point.
2. **+ Anonymous evaluation (US3)** — server-side mask threads through every read path; ships immediately after US1+US2 stabilise.
3. **+ Insights (US4)** — three aggregator endpoints + Recharts surfaces; ships once US3 is in so the tooltips honour anonymity.
4. **+ Makeover (US5)** — re-skin pass over the whole portal using `tokens.css` and `AppShell`; ships last among the stories.
5. **+ Hardening (FR-037, FR-038)** — Employee dashboard History tab and Reviewer queue status filter fixes; lands alongside the makeover.
6. **Polish** — docs, demo data, gates, merge-back to `main` with `--no-ff`.

---

## Task count summary

- Setup: 5 (T001–T005)
- Foundational: 15 (T006–T020)
- US1 Drafts: 13 (T021–T033)
- US2 Ratings + Comments: 18 (T034–T051)
- US3 Anonymous Evaluation: 8 (T052–T059)
- US4 Insights: 9 (T060–T068)
- US5 Makeover: 7 (T069–T075)
- Hardening (FR-037 + FR-038): 9 (T076–T084)
- Polish & merge: 7 (T085–T091)
- **Total: 91 tasks** across 5 user stories + 1 hardening phase.
