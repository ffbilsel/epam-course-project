# Quickstart — Phase 3 (Idea Listing & Management Enhancements)

**Branch**: `003-idea-listing-management`
**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md)

This walks through what an engineer (or the agent) does locally to
implement, run, and verify Phase 3 on top of an existing Phase 1/2
checkout.

## 1. Prerequisites

Same as Phase 2:

- Node.js 20.x, npm 10.x
- A working clone of the repo on branch `003-idea-listing-management`
- `.env` already populated (`DATABASE_URL`, `NEXTAUTH_SECRET`, `UPLOAD_ROOT`)

## 2. Install + migrate

```pwsh
npm install                # no new deps; lockfile unchanged
npm run db:migrate         # applies drizzle/0002_listing_and_edits.sql
```

The migration:

- Rewrites the `status_transitions` CHECK constraint so the
  `from = to` edit-marker case is legal (see ADR-0015).
- Creates `idx_ideas_search` on `(status, category_id, created_at)`.

To verify after migrate:

```pwsh
sqlite3 data/portal.sqlite ".schema status_transitions"
sqlite3 data/portal.sqlite ".indexes ideas"
```

## 3. Seed sample data (recommended for listing/search work)

```pwsh
npm run seed:demo          # existing script — categories, ideas, users
```

The seed already produces ~30 ideas across 3 categories and 4 users,
enough to exercise pagination's first page edge-case (20 rows ÷
default page size). To stress the SC-004 budget, bump the loop in
`scripts/seed-demo.ts` temporarily to 10 000 rows and run
`npm run seed:demo` again.

## 4. Run the dev server

```pwsh
npm run dev
```

Hit each surface manually:

| URL | Story | Expected |
|---|---|---|
| `/my-ideas` | 2, 3 | filter bar, page size selector, URL reflects filters |
| `/my-ideas?status=SUBMITTED&q=coffee` | 2 | server-rendered subset |
| `/ideas/<id>` (own + SUBMITTED) | 1 | Edit + Delete buttons visible |
| `/ideas/<id>` (own + APPROVED) | 1 | Edit + Delete buttons absent |
| `/ideas/<id>/edit` | 1 | form prefilled; PATCH on submit |
| `/ideas/<id>` → History tab | 4 | chronological events |
| `/queue?status=UNDER_REVIEW` | 2 | reviewer scope |
| `/admin/ideas` | 5 | listing + "Export CSV" button |

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

New test files added in Phase 3 (must all pass):

- `tests/unit/lib/format/csv.test.ts`
- `tests/unit/lib/validation/listing-query.test.ts`
- `tests/unit/server/idea-listing.test.ts`
- `tests/unit/server/idea-history.test.ts`
- `tests/unit/server/idea-service.edit-delete.test.ts`
- `tests/integration/ideas-listing.test.ts`
- `tests/integration/ideas-edit-delete.test.ts`
- `tests/integration/ideas-history.test.ts`
- `tests/integration/ideas-export-csv.test.ts`
- `tests/e2e/employee-edit-own-idea.spec.ts`
- `tests/e2e/reviewer-filter-and-export.spec.ts`

## 6. Acceptance walk-through (matches spec.md SC-001 … SC-006)

1. **SC-001** — As employee, open an own `SUBMITTED` idea → Edit
   button visible. Open an own `APPROVED` idea → Edit button gone;
   curl the `PATCH` endpoint and assert HTTP 409 + `IDEA_NOT_EDITABLE`.
2. **SC-002** — Submit a search of `"   "` → falls back to "no filter".
   Submit `"a".repeat(201)` → HTTP 400 + `IDEA_LISTING_SEARCH_TOO_LONG`.
3. **SC-003** — With 10 000 seeded ideas, `time curl
   "http://localhost:3000/api/ideas?q=coffee&scope=mine"` should
   return in < 200 ms wall-clock (rough; the real measurement is
   in the integration test using `performance.now()`).
4. **SC-004** — Same dataset, repeated page loads `/my-ideas?page=N`
   render server-side in < 500 ms 95th percentile.
5. **SC-005** — On the detail page, every author edit appears in the
   History tab within a single page render; no client-side polling.
6. **SC-006** — From `/admin/ideas`, click "Export CSV" → the
   download completes in < 10 s on the 10 000-row dataset.

## 7. Commit cadence

The SpecKit `auto_commit` hooks (`.specify/extensions.yml`) commit
after every slash-command and the `post-commit` hook pushes. While
implementing, each task in `tasks.md` ends with its own
`feat:`/`test:`/`refactor:` commit per Constitution VIII; the
final task performs `git merge --no-ff` of the feature branch back
into `main`.
