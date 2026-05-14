# Quickstart — Phase 4 (Advanced Evaluation Experience)

**Branch**: `004-advanced-evaluation-experience`
**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md)

This walks through what an engineer (or the agent) does locally to
implement, run, and verify Phase 4 on top of an existing Phase 1–3
checkout.

## 1. Prerequisites

Same as Phase 3, plus:

- Node.js 20.x, npm 10.x
- A working clone of the repo on branch `004-advanced-evaluation-experience`
- `.env` already populated (`DATABASE_URL`, `NEXTAUTH_SECRET`, `UPLOAD_ROOT`)

## 2. Install + migrate

```pwsh
npm install                # installs the one new dep: recharts ^2.12
npm run db:migrate         # applies drizzle/0003_drafts_ratings_comments.sql
```

The migration:

- Adds `categories.anonymous_default` (default `0`).
- Adds `ideas.anonymous` (default `0`; existing rows stay non-anonymous).
- Creates the four new tables (`idea_drafts`, `rating_dimensions`,
  `ratings`, `comments`) and the new index
  `idx_ideas_status_created`.
- Seeds the four default rating dimensions (Feasibility, Impact,
  Originality, Alignment) with `category_id = NULL`.

To verify after migrate:

```pwsh
sqlite3 data/portal.sqlite ".schema idea_drafts"
sqlite3 data/portal.sqlite ".schema ratings"
sqlite3 data/portal.sqlite ".schema comments"
sqlite3 data/portal.sqlite "SELECT label, required FROM rating_dimensions WHERE category_id IS NULL ORDER BY position;"
sqlite3 data/portal.sqlite ".indexes ideas"
```

## 3. Seed sample data (recommended for Insights work)

```pwsh
npm run seed:demo          # existing script — extended with anonymous category + decisions
```

The seed now also produces:

- One category flagged `anonymous_default = 1` ("People & Culture")
  with ≥ 5 ideas authored by varied users so the anonymity projection
  is exercised.
- ≥ 30 decided ideas across the time range so the Insights charts
  render with non-trivial data on first load.

To stress NFR-001 (≤ 2 s per chart at 10 000 ideas) bump the loop in
`scripts/seed-demo.ts` and re-run.

## 4. Run the dev server

```pwsh
npm run dev
```

Hit each surface manually:

| URL | Story | Expected |
|---|---|---|
| `/drafts` | 1 | Empty state on first visit; "Save draft" from `/ideas/new` populates it |
| `/ideas/new` | 1 | "Save draft" button posts to `/api/drafts`; redirects to `/drafts` |
| `/drafts/<id>` | 1 | Form prefilled; PUT on autosave; Submit promotes draft to idea |
| `/ideas/<id>` (own, SUBMITTED) | 2 | Rating panel hidden (you're the author), comment thread visible |
| `/ideas/<id>` (as EVALUATOR, UNDER_REVIEW) | 2 | Rating panel with all dimensions; comment composer; Approve/Reject blocked while required dims unrated |
| `/ideas/<id>` (anonymous, as EVALUATOR) | 3 | Author panel reads "Anonymous Submitter"; comments by author masked |
| `/ideas/<id>` (anonymous, as ADMIN) | 3 | Real author identity visible |
| `/admin/insights` | 4 | Three charts populated; range-picker re-renders all three |
| `/insights` (as EVALUATOR) | 4 | Same charts, no per-submitter breakdowns |
| `/insights` (as EMPLOYEE) | 4 | Redirect / forbidden page |
| `/dashboard` | FR-037 | History tab listing your concluded submissions |
| `/queue` | FR-038 | Status filter works; clear-all = no filter; URL reflects state |
| Dark-mode toggle (top nav) | 5 | All pages re-theme; no flash on navigation |

## 5. Run the test suites

```pwsh
npm run lint
npm run typecheck
npm test                   # unit + integration (Vitest)
npm run test:e2e           # Playwright + axe
npm run format -- --check
npm run check:error-codes
npm run check:ui-tokens
```

New test files added in Phase 4:

- **Unit** (`tests/unit/`):
  - `server/draft-service.test.ts`
  - `server/rating-service.test.ts`
  - `server/comment-service.test.ts`
  - `server/anonymity.test.ts`
  - `server/insights-service.test.ts`
  - `lib/validation/rating.test.ts`
  - `lib/validation/comment.test.ts`
  - `lib/format/plain-text.test.ts`

- **Integration** (`tests/integration/`):
  - `drafts-lifecycle.test.ts`
  - `ratings-record-and-lock.test.ts`
  - `comments-thread.test.ts`
  - `anonymity-projection.test.ts` (covers SC-005 across every
    EVALUATOR-facing endpoint)
  - `insights-endpoints.test.ts`
  - `employee-history-tab.test.ts` (FR-037)
  - `queue-status-filter.test.ts` (FR-038)

- **E2E** (`tests/e2e/`):
  - `employee-save-and-submit-draft.spec.ts`
  - `reviewer-rate-and-comment.spec.ts`
  - `admin-insights-and-dark-mode.spec.ts`

Each E2E spec runs `@axe-core/playwright` before completing and fails
on any serious or critical violation.

## 6. Smoke checklist before merging

1. `npm run check` (full pre-merge gate) — green.
2. Open `/insights` in both light and dark mode; confirm:
   - Chart background, axis text, and tooltip surface re-skin
     correctly.
   - Hovering each chart shows exact numeric values (FR-030).
   - Picking a range that yields zero data shows the per-chart empty
     state (not a flatline).
3. Submit an anonymous idea (Admin override on a normally-non-
   anonymous category) and confirm in a fresh EVALUATOR session:
   - Queue row shows "Anonymous Submitter".
   - Detail page, comment thread, and history tab all mask the
     submitter consistently.
   - The submitter, viewing the same idea, still sees themselves.
4. Toggle Admin per-idea anonymity off; refresh as EVALUATOR;
   confirm the author identity becomes visible from then on (no
   retroactive renaming of past comments — see FR-022 last bullet).
5. As an EMPLOYEE, visit `/dashboard` — the History tab lists only
   `APPROVED`, `REJECTED`, `IMPLEMENTED` ideas you authored, with
   final decision and concluded date.
6. As an EVALUATOR, visit `/queue`:
   - Select two statuses → results scope; URL updates.
   - Clear all → no filter; full queue visible.
   - Combine status + category + search → logical intersection.
   - Reload the URL → filter state restored.
7. Manual a11y pass: keyboard-only walkthrough of the rating panel
   (Tab cycles dimensions; Space/Enter select scores) and the comment
   thread (focus order matches reading order; soft-deleted comments
   announced via `aria-live`).
