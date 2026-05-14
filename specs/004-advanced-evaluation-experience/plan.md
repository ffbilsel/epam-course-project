# Implementation Plan: Advanced Evaluation Experience (Phase 4)

**Branch**: `004-advanced-evaluation-experience` | **Date**: 2026-05-14 |
**Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from
`/specs/004-advanced-evaluation-experience/spec.md`

## Summary

Phase 4 layers the *evaluation experience* on top of the Phase 1–3
codebase without disturbing the lifecycle, role model, or attachment
rules. Six coordinated capabilities ship together:

1. **Drafts** (Story 1, P1) — a separate, author-private `idea_drafts`
   table that holds work-in-progress. Submitting a draft promotes it
   into an `ideas` row in `SUBMITTED`. Drafts are invisible to every
   other role and to every aggregate query.
2. **Multi-dimensional 1–5 ratings** (Story 2, P1) — per-category
   `rating_dimensions` (with a default set for categories that do not
   override) plus per-evaluator `ratings` rows, locked the moment that
   evaluator records a decision.
3. **Comment threads** (Story 2, P1) — a single `comments` table with
   one level of nesting, soft-delete with moderator attribution, and a
   `kind = 'DECISION'` slot for the decision comment so history and
   discussion live in one place.
4. **Anonymous evaluation** (Story 3, P2) — `categories.anonymous_default`
   feeds an `ideas.anonymous` flag that is **set at submission time**
   and may be overridden per-idea by Admins. Submitter identity is
   server-side masked from EVALUATORs on every read path (queue,
   detail, thread, history); ADMINs always see the real submitter.
5. **Insight dashboards** (Story 4, P2) — three Recharts-rendered charts
   (Submission Trend, Approval Rate, Category Distribution) fed by
   three pure aggregator endpoints. ADMIN sees full data; EVALUATOR
   sees aggregate-only; EMPLOYEE is forbidden.
6. **Frontend makeover** (Story 5, P2) — adopt a single Tailwind/shadcn
   design-token set, add a working dark mode (CSS-variable-based), and
   ship a shared `AppShell` (top nav + role-aware sidebar) used by every
   authenticated page.

**Hardening (additional)**:

- **FR-037** — Employee dashboard "History" tab listing the signed-in
  Employee's concluded submissions (`APPROVED`, `REJECTED`, or
  `IMPLEMENTED`). Reuses the Phase-3 listing query path with a fixed
  status set; anonymity is irrelevant here because the viewer is the
  author.
- **FR-038** — Reviewer review-queue status filter is corrected: the
  set of selectable statuses matches the surface, "no selection" means
  "no filter" (not "no results"), the filter is URL-bound and survives
  reload, intersects with category + search, and the empty-state
  message distinguishes "no matches" from "queue empty".

The plan resolves the three `NEEDS CLARIFICATION` markers from the
spec as follows — all three are pinned in
[research.md](./research.md) and recorded as ADRs:

| Spec clarification | Resolution |
|---|---|
| Anonymous toggle owner | Per-category default + Admin per-idea override at submission. Submitters do **not** toggle anonymity in v1. |
| Reviewer assignment model | Unchanged from Phase 3 — any EVALUATOR may pick up any idea in `SUBMITTED`/`UNDER_REVIEW`; multiple evaluators may record their own ratings; the *deciding* evaluator's required-dimension check is the gate. |
| Chart library | Recharts (lockfile-pinned), styled with the Tailwind design tokens. |

Phase 4 introduces four new tables (`idea_drafts`, `rating_dimensions`,
`ratings`, `comments`) and two columns on existing tables
(`categories.anonymous_default`, `ideas.anonymous`). No change to the
existing idea state machine. No new role.

## Technical Context

**Language/Version**: TypeScript ~5.4 (strict mode, unchanged from
Phase 1–3); Node.js `>=20 <21`.

**Primary Dependencies**: unchanged from Phase 3 — Next.js 14 (App
Router), React 18, Tailwind CSS, shadcn/ui, Zod, React Hook Form +
`@hookform/resolvers/zod`, NextAuth v5 + Drizzle adapter, Drizzle ORM
+ `better-sqlite3`, `date-fns`, `lucide-react`,
`class-variance-authority`, `sonner`. **One new runtime dependency**:
`recharts ^2.12` for the Insights charts (Story 4, ADR-0021). Comment
content is rendered through a tiny in-house plain-text → HTML escaper
that converts `\n` to `<br>` and HTML-escapes everything else — no
sanitiser dependency required (NFR-007).

**Storage**: SQLite via `better-sqlite3`. **Schema delta**
(Drizzle migration `drizzle/0003_drafts_ratings_comments.sql`):

1. New table `idea_drafts` — author-private work-in-progress. Columns
   mirror the editable surface of `ideas` (`title`, `description`,
   `categoryId`, `categoryAnswers` JSON) plus `authorId`, `createdAt`,
   `updatedAt`. Foreign key to `users.id` `ON DELETE CASCADE`; FK to
   `categories.id` is `ON DELETE SET NULL` so a deactivated category
   does not destroy in-progress work.
2. New table `rating_dimensions` — `(id, categoryId, label,
   description, position, required, active)`. `categoryId IS NULL`
   denotes the default set seeded with the migration. Composite
   uniqueness on `(categoryId, lower(label))`.
3. New table `ratings` — `(id, ideaId, evaluatorId, dimensionId,
   score 1..5 NULL, lockedAt, createdAt, updatedAt)`. UNIQUE on
   `(ideaId, evaluatorId, dimensionId)`. `lockedAt` set when the
   evaluator's decision transition fires (`UNDER_REVIEW → APPROVED |
   REJECTED`); after that, that row is read-only.
4. New table `comments` — `(id, ideaId, authorId, authorRoleAtPost,
   parentId NULL, kind in {'COMMENT','DECISION'}, body, createdAt,
   editedAt NULL, deletedAt NULL, deletedById NULL)`. `parentId`
   references `comments.id`; the **one-level nesting invariant** (a
   comment with non-null `parentId` cannot itself be referenced as a
   parent) is enforced in the service.
5. New column `categories.anonymous_default INTEGER NOT NULL DEFAULT 0`
   (0/1 boolean). Default flag for newly submitted ideas.
6. New column `ideas.anonymous INTEGER NOT NULL DEFAULT 0` (0/1
   boolean). **Snapshot** of the category default at submission time,
   overridable by an Admin per-idea (ADR-0018).
7. New composite indexes: `idx_ratings_idea` on `(ideaId)`,
   `idx_comments_idea_created` on `(ideaId, createdAt)`,
   `idx_drafts_author_updated` on `(authorId, updatedAt)`,
   `idx_ideas_status_created` (additive to Phase-3 `idx_ideas_search`)
   to make the Insights submissions-per-bucket query covering.
8. The Phase-3 `EDITED` audit-row encoding is unchanged. The Phase-4
   audit kinds (`DRAFT_SUBMITTED`, `RATING_RECORDED`, `COMMENT_POSTED`,
   `DECISION`) are **not** new `status_transitions` rows — they are
   read from `ratings`, `comments`, and existing transition rows by
   the history-tab folder. No new audit table.

**Testing**: Vitest 1.6 (`unit` + `integration` projects), RTL 16,
Playwright 1.45 with `@axe-core/playwright`. Coverage thresholds
unchanged (≥ 70% line on `src/server/**` and the business-logic
subset of `src/lib/**`).

**Target Platform**: identical to Phase 1–3 (Chromium/Firefox/Safari
on desktop/tablet/mobile ≥ 360 px).

**Project Type**: Full-stack web app (Next.js, single repo).

**Performance Goals**:

- 95 % of `POST /api/drafts`, `PUT /api/ideas/[id]/ratings`, and
  `POST /api/ideas/[id]/comments` complete under **500 ms** server-
  side at the spec's scale (NFR-002).
- Each Insights chart renders its initial dataset under **2 s** on a
  10 000-idea seed (NFR-001, SC-006). Achieved by serving three pre-
  aggregated endpoints (`/api/insights/trend`, `/approval-rate`,
  `/category-distribution`), each running a single covering query
  against `ideas` + `status_transitions`.
- Anonymity check on every read path is a single boolean column on
  the idea row — zero overhead.

**Constraints**: no external services; no new database engine; no new
authentication mechanism; no new role; CSV export from Phase 3 is
**not** required to change in v1. Comment content is plain text +
line breaks only (NFR-007). Anonymity is server-enforced (NFR-003) —
the UI is a render of the server projection, never the policy.

**Scale/Scope**: ≤ 1 000 active users, ≤ 10 000 ideas, ≤ 50 000
comments, ≤ 200 000 ratings. 38 functional requirements (FR-001…
FR-038), 5 user stories + 2 hardening items, 4 new tables, 2 new
columns, 1 new runtime dependency (`recharts`), 6 new ADRs
(ADR-0017…0022).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at **v1.4.0** has **10 principles** and **12 quality
gates**. Each is evaluated below; **no violations require
justification**.

### Principle compliance

| Principle | Compliance |
|---|---|
| **I. Clean Code** | New server modules (`draft-service.ts`, `rating-service.ts`, `comment-service.ts`, `anonymity.ts`, `insights-service.ts`) are single-purpose; each public function ≤ 30 logical lines. The anonymity projection is a pure `maskAuthor(idea, viewer)` function reused by every read path. No dead code; no inline TODOs. |
| **II. TypeScript Strict** | Every payload (draft save, draft submit, rating PUT, comment POST, insights range) is parsed through a Zod schema; `URLSearchParams` and JSON bodies cross the type boundary exactly once. No `any`, no `!`, no `@ts-ignore`. Discriminated unions distinguish a `Draft` from a submitted `Idea` at the type level so the listing query cannot mistake one for the other. |
| **III. Testing Pyramid 70%** | New business logic (`draft-service.ts`, `rating-service.ts`, `comment-service.ts`, `anonymity.ts`, `insights-service.ts`, dimension validators) sits in `src/server/**` and `src/lib/validation/**`, both inside the 70% floor. |
| **IV. JSDoc** | Every exported function, type, and component prop gets a JSDoc block (`@param` + `@returns` + `@throws` where applicable). The `maskAuthor` helper carries an `@example` because its contract (one-way anonymity) is non-obvious. |
| **V. Testing Principles** | AAA layout; `beforeEach` isolation; in-memory fakes for unit tests of services; fresh-SQLite per integration suite. Required-dimension validation is unit-tested as a pure function with `it.each` tables (one assertion per case). Anonymity is contract-tested per endpoint to satisfy SC-005. |
| **VI. UX (responsive, a11y, polish)** | New surfaces (Drafts list, draft editor, rating panel, comment thread, Insights, Employee History) all carry explicit loading / empty / error / success states. Mobile-first; the rating panel collapses to a stacked grid below `sm:`; the comment composer is sticky at the bottom on mobile. Charts expose hover tooltips with exact values and an explicit "no data in range" empty state per chart (FR-030). Dark mode is a CSS-variable theme toggled in `AppShell`. `@axe-core/playwright` covers every new page. |
| **VII. Consistency (UI, code, error codes)** | New error codes added to `src/lib/errors/codes.ts`: `DRAFT_NOT_FOUND`, `DRAFT_FORBIDDEN`, `DRAFT_VALIDATION`, `RATING_INVALID_SCORE`, `RATING_REQUIRED_MISSING`, `RATING_LOCKED`, `COMMENT_NOT_FOUND`, `COMMENT_FORBIDDEN`, `COMMENT_TOO_LONG`, `COMMENT_NESTING_EXCEEDED`, `COMMENT_EDIT_WINDOW_EXPIRED`, `INSIGHTS_FORBIDDEN`, `INSIGHTS_RANGE_INVALID`. UI strings live in `error-messages.ts`. Recharts theming reads the same design tokens as the rest of the app; no hard-coded hex values. The shared `AppShell` removes one-off page chrome from features 001–003. |
| **VIII. Commit & Push Discipline** | SpecKit `auto_commit` hooks (`.specify/extensions.yml`) plus the `post-commit` push hook continue to drive Conventional Commits + immediate `git push` per lifecycle step and per task. |
| **IX. ADR-Backed Design Choices** | Every load-bearing choice has a MADR ADR under [./adr/](./adr/): Drafts as a separate table (ADR-0017); anonymity = category default + Admin override snapshotted on submit (ADR-0018); ratings schema + lock-on-decide (ADR-0019); comment thread with one-level nesting + soft delete (ADR-0020); Recharts as the chart engine (ADR-0021); makeover design-token strategy + dark mode (ADR-0022). |
| **X. Feature Merge Discipline** | Feature branch `004-advanced-evaluation-experience` merges to `main` exclusively via `git merge --no-ff` once Quality Gates 1–11 pass. Encoded as the final task in `tasks.md`. |

### Quality gates

| # | Gate | How this plan satisfies it |
|---|---|---|
| 1 | `tsc --noEmit` strict | unchanged; `npm run typecheck` in CI. |
| 2 | ESLint + Prettier zero errors | unchanged toolchain. |
| 3 | Unit + integration + E2E pass | new tests in each tier (see [./quickstart.md](./quickstart.md)). |
| 4 | ≥ 70% line on business logic | new modules `draft-service.ts`, `rating-service.ts`, `comment-service.ts`, `anonymity.ts`, `insights-service.ts`, plus new validators, covered ≥ 70%. |
| 5 | JSDoc on exports | `eslint-plugin-jsdoc` enforces. |
| 6 | Code review / Constitution note | solo course project — self-review with rationale per PR. |
| 7 | Constitution Check | this section. |
| 8 | A11y/responsiveness | jsx-a11y + axe; manual checklist for the rating panel, comment thread, Insights charts, and dark-mode toggle at all three breakpoints. |
| 9 | Consistency | 13 new error codes with one-test-per-code; error envelope reused unchanged; Recharts wrapped in `src/components/insights/*` consuming Tailwind tokens; no inline `style` props. |
| 10 | Commit & push discipline | inherited automation. |
| 11 | ADR coverage | ADR-0017…0022 cover every new design choice; ADR index `specs/004-advanced-evaluation-experience/adr/README.md` lists them. |
| 12 | Feature merge-back | final task performs `git merge --no-ff` to `main`. |

### Excluded coverage paths (documented per V.2)

Unchanged from Phase 1–3: `src/app/**` page/layout files,
`src/components/ui/**`, `src/lib/errors/codes.ts`, `drizzle/**`,
`src/db/seed.ts`. Newly excluded: `src/components/insights/charts/*`
— thin Recharts wrappers that contain no business logic (data
preparation happens in `insights-service.ts`, which IS covered). Each
new excluded path is added explicitly to the `coverage.exclude` list
in `vitest.config.ts`.

**Result**: PASS. Re-check after Phase 1 design — no expected drift.

## Project Structure

### Documentation (this feature)

```text
specs/004-advanced-evaluation-experience/
├── plan.md              # This file
├── spec.md              # Authoritative spec
├── research.md          # Phase 0 — decisions & alternatives
├── data-model.md        # Phase 1 — entities + state diagrams + payload shapes
├── quickstart.md        # Phase 1 — run/test/migrate locally
├── adr/
│   ├── README.md
│   ├── 0017-drafts-separate-table.md
│   ├── 0018-anonymity-model.md
│   ├── 0019-ratings-schema.md
│   ├── 0020-comment-thread-shape.md
│   ├── 0021-recharts-as-chart-engine.md
│   └── 0022-makeover-design-tokens.md
├── contracts/
│   └── openapi.yaml     # Phase 1 — REST delta for drafts, ratings, comments, insights, hardening
├── checklists/
│   └── requirements.md  # (carried over from /speckit.specify; not authored here)
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root) — additions and changes only

```text
project/
├── drizzle/
│   └── 0003_drafts_ratings_comments.sql           # NEW migration (4 tables + 2 cols + indexes)
├── src/
│   ├── app/
│   │   ├── (employee)/
│   │   │   ├── drafts/page.tsx                    # NEW — My Drafts listing (Story 1)
│   │   │   ├── drafts/[id]/page.tsx               # NEW — Draft editor
│   │   │   ├── ideas/new/page.tsx                 # CHANGED — adds "Save draft" action
│   │   │   ├── dashboard/page.tsx                 # CHANGED — adds History tab (FR-037)
│   │   │   └── ideas/[id]/page.tsx                # CHANGED — rating panel + thread
│   │   ├── (reviewer)/queue/page.tsx              # CHANGED — corrected status filter (FR-038)
│   │   ├── (admin)/
│   │   │   ├── categories/[id]/page.tsx           # CHANGED — dimension editor + anonymous default
│   │   │   └── insights/page.tsx                  # NEW — Insights dashboard (Story 4)
│   │   ├── (reviewer)/insights/page.tsx           # NEW — restricted Insights view
│   │   └── api/
│   │       ├── drafts/
│   │       │   ├── route.ts                       # NEW — POST create, GET list (author scope)
│   │       │   └── [id]/route.ts                  # NEW — GET, PUT update, DELETE, POST submit
│   │       ├── ideas/[id]/
│   │       │   ├── ratings/route.ts               # NEW — GET, PUT (own scores)
│   │       │   ├── comments/route.ts              # NEW — GET, POST
│   │       │   └── comments/[commentId]/route.ts  # NEW — PATCH (edit), DELETE
│   │       ├── insights/
│   │       │   ├── trend/route.ts                 # NEW — GET submission trend
│   │       │   ├── approval-rate/route.ts         # NEW — GET approval-rate KPI + series
│   │       │   └── category-distribution/route.ts # NEW — GET per-category share
│   │       └── categories/
│   │           └── [id]/dimensions/route.ts       # NEW — admin CRUD for rating dimensions
│   ├── components/
│   │   ├── drafts/
│   │   │   ├── draft-list.tsx                     # NEW
│   │   │   ├── draft-editor.tsx                   # NEW (wraps the smart form + autosave)
│   │   │   └── save-draft-button.tsx              # NEW
│   │   ├── ratings/
│   │   │   ├── rating-panel.tsx                   # NEW (per-dimension 1–5 selector)
│   │   │   └── rating-summary.tsx                 # NEW (post-decision read-only)
│   │   ├── comments/
│   │   │   ├── comment-thread.tsx                 # NEW (top-level + one-level replies)
│   │   │   ├── comment-composer.tsx               # NEW (textarea + post)
│   │   │   └── comment-item.tsx                   # NEW (edit-within-5-min + soft-delete render)
│   │   ├── insights/
│   │   │   ├── insights-page.tsx                  # NEW — range picker + 3 charts
│   │   │   ├── range-picker.tsx                   # NEW
│   │   │   └── charts/
│   │   │       ├── submission-trend-chart.tsx     # NEW — Recharts AreaChart
│   │   │       ├── approval-rate-chart.tsx        # NEW — Recharts ComposedChart
│   │   │       └── category-distribution-chart.tsx# NEW — Recharts BarChart
│   │   ├── layout/
│   │   │   ├── app-shell.tsx                      # NEW — shared chrome (Story 5)
│   │   │   ├── sidebar.tsx                        # NEW — role-aware nav
│   │   │   └── theme-toggle.tsx                   # NEW — light/dark/system (FR-033)
│   │   └── admin/
│   │       └── rating-dimensions-editor.tsx       # NEW — category admin page
│   ├── server/
│   │   ├── draft-service.ts                       # NEW
│   │   ├── rating-service.ts                      # NEW
│   │   ├── comment-service.ts                     # NEW
│   │   ├── anonymity.ts                           # NEW — pure maskAuthor + maskHistoryEvent
│   │   ├── insights-service.ts                    # NEW — three aggregator queries
│   │   ├── idea-service.ts                        # CHANGED — emits decision comment + locks ratings
│   │   └── idea-listing.ts                        # CHANGED — applies anonymity projection
│   ├── db/
│   │   └── repositories/
│   │       ├── draft-repo.ts                      # NEW
│   │       ├── rating-repo.ts                     # NEW
│   │       ├── comment-repo.ts                    # NEW
│   │       ├── dimension-repo.ts                  # NEW
│   │       └── insights-repo.ts                   # NEW — aggregator queries
│   ├── lib/
│   │   ├── validation/
│   │   │   ├── draft.ts                           # NEW — SaveDraftSchema, SubmitDraftSchema
│   │   │   ├── rating.ts                          # NEW — RatingPutSchema (per-dimension 1..5|null)
│   │   │   ├── comment.ts                         # NEW — CommentPostSchema (≤ 2 000 chars)
│   │   │   └── insights.ts                        # NEW — InsightsRangeSchema
│   │   ├── format/
│   │   │   └── plain-text.ts                      # NEW — escapeAndLinebreak (NFR-007)
│   │   ├── hooks/
│   │   │   ├── use-theme.ts                       # NEW
│   │   │   └── use-draft-autosave.ts              # NEW — debounced PUT
│   │   └── errors/
│   │       ├── codes.ts                           # CHANGED — add 13 new codes
│   │       └── error-messages.ts                  # CHANGED — UI copy for new codes
│   ├── styles/
│   │   └── tokens.css                             # NEW — design-token CSS variables (Story 5)
│   └── types/index.ts                             # CHANGED — re-export Draft, Rating, Comment, Insights
├── tests/
│   ├── unit/
│   │   ├── server/draft-service.test.ts                       # NEW
│   │   ├── server/rating-service.test.ts                      # NEW
│   │   ├── server/comment-service.test.ts                     # NEW
│   │   ├── server/anonymity.test.ts                           # NEW
│   │   ├── server/insights-service.test.ts                    # NEW
│   │   ├── lib/validation/rating.test.ts                      # NEW
│   │   ├── lib/validation/comment.test.ts                     # NEW
│   │   └── lib/format/plain-text.test.ts                      # NEW
│   ├── integration/
│   │   ├── drafts-lifecycle.test.ts                           # NEW (Story 1)
│   │   ├── ratings-record-and-lock.test.ts                    # NEW (Story 2)
│   │   ├── comments-thread.test.ts                            # NEW (Story 2)
│   │   ├── anonymity-projection.test.ts                       # NEW (Story 3, SC-005)
│   │   ├── insights-endpoints.test.ts                         # NEW (Story 4)
│   │   ├── employee-history-tab.test.ts                       # NEW (FR-037)
│   │   └── queue-status-filter.test.ts                        # NEW (FR-038)
│   └── e2e/
│       ├── employee-save-and-submit-draft.spec.ts             # NEW (Story 1, axe-checked)
│       ├── reviewer-rate-and-comment.spec.ts                  # NEW (Story 2, axe-checked)
│       └── admin-insights-and-dark-mode.spec.ts               # NEW (Stories 4 + 5, axe-checked)
```

**Structure Decision**: Reuse the existing single-app Next.js layout
under `src/`. No new top-level folder. Each new concern (drafts,
ratings, comments, anonymity, insights) is isolated into its own
small `src/server/` module and its own `src/components/<concern>/`
folder, mirroring the Phase-3 pattern. The shared `AppShell`
introduced by the makeover (Story 5) replaces the ad-hoc page chrome
that pages from features 001–003 currently carry — those pages are
re-skinned, not rewritten.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | _n/a_ | _n/a_ |
