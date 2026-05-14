# Phase 1 — Data Model: Advanced Evaluation Experience

**Feature**: `004-advanced-evaluation-experience`
**Date**: 2026-05-14
**Inputs**: [plan.md](./plan.md), [research.md](./research.md),
existing schema in `src/db/schema.ts` (Phase 1–3).

This document defines the **runtime shapes** introduced by Phase 4
and the migration that backs them. Four new tables, two new columns,
zero changes to the idea state machine grammar.

---

## 1. Schema delta

`drizzle/0003_drafts_ratings_comments.sql`:

```sql
PRAGMA foreign_keys = OFF;
BEGIN;

-- (1) New column: categories.anonymous_default
ALTER TABLE categories
  ADD COLUMN anonymous_default INTEGER NOT NULL DEFAULT 0
  CHECK (anonymous_default IN (0, 1));

-- (2) New column: ideas.anonymous (snapshotted at submission)
ALTER TABLE ideas
  ADD COLUMN anonymous INTEGER NOT NULL DEFAULT 0
  CHECK (anonymous IN (0, 1));

-- (3) New table: idea_drafts
CREATE TABLE idea_drafts (
  id               TEXT PRIMARY KEY,
  author_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT '',
  description      TEXT NOT NULL DEFAULT '',
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category_answers TEXT NOT NULL DEFAULT '[]',
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX idx_drafts_author_updated ON idea_drafts(author_id, updated_at);

-- (4) New table: rating_dimensions
CREATE TABLE rating_dimensions (
  id          TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id) ON DELETE CASCADE, -- NULL = default set
  label       TEXT NOT NULL,
  description TEXT,
  position    INTEGER NOT NULL DEFAULT 0,
  required    INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at  INTEGER NOT NULL
);
CREATE UNIQUE INDEX uniq_dimensions_cat_label
  ON rating_dimensions(IFNULL(category_id, '__default__'), lower(label));
CREATE INDEX idx_dimensions_category ON rating_dimensions(category_id, position);

-- Seed the default set (used when a category has no rows of its own).
INSERT INTO rating_dimensions (id, category_id, label, description, position, required, active, created_at)
VALUES
  ('dim-default-feasibility',  NULL, 'Feasibility',  'How realistic is this idea to build?',    1, 1, 1, unixepoch()),
  ('dim-default-impact',       NULL, 'Impact',       'Expected magnitude of value if shipped.', 2, 1, 1, unixepoch()),
  ('dim-default-originality',  NULL, 'Originality',  'How novel is the approach?',              3, 0, 1, unixepoch()),
  ('dim-default-alignment',    NULL, 'Alignment',    'Fit with current strategic priorities.',  4, 0, 1, unixepoch());

-- (5) New table: ratings (per evaluator, per dimension)
CREATE TABLE ratings (
  id           TEXT PRIMARY KEY,
  idea_id      TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  evaluator_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  dimension_id TEXT NOT NULL REFERENCES rating_dimensions(id) ON DELETE RESTRICT,
  score        INTEGER CHECK (score IS NULL OR score BETWEEN 1 AND 5),
  locked_at    INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  UNIQUE (idea_id, evaluator_id, dimension_id)
);
CREATE INDEX idx_ratings_idea ON ratings(idea_id);
CREATE INDEX idx_ratings_evaluator ON ratings(evaluator_id);

-- (6) New table: comments
CREATE TABLE comments (
  id                   TEXT PRIMARY KEY,
  idea_id              TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  author_id            TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  author_role_at_post  TEXT NOT NULL CHECK (author_role_at_post IN ('EMPLOYEE','EVALUATOR','ADMIN')),
  parent_id            TEXT REFERENCES comments(id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL DEFAULT 'COMMENT' CHECK (kind IN ('COMMENT','DECISION')),
  body                 TEXT NOT NULL,
  created_at           INTEGER NOT NULL,
  edited_at            INTEGER,
  deleted_at           INTEGER,
  deleted_by_id        TEXT REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX idx_comments_idea_created ON comments(idea_id, created_at);
CREATE INDEX idx_comments_parent ON comments(parent_id);

-- (7) Listing perf index for Insights submission-trend query.
CREATE INDEX idx_ideas_status_created ON ideas(status, created_at);

COMMIT;
PRAGMA foreign_keys = ON;
```

> **Nesting invariant** (enforced in service layer, not SQL): a row
> with `parent_id IS NOT NULL` may never be referenced as another
> row's `parent_id`. Validated in `comment-service.ts`.

---

## 2. Entity — `Draft`

```ts
type Draft = {
  id:              string;
  authorId:        string;
  title:           string;                 // may be empty until submit
  description:     string;
  categoryId:      string | null;          // null if previously-set category was deactivated
  categoryAnswers: AnswerEntry[];          // Phase-2 shape, unchanged
  createdAt:       string;                 // ISO-8601 UTC
  updatedAt:       string;
};

type DraftSummary = Pick<Draft, 'id' | 'title' | 'categoryId' | 'updatedAt'>;
```

**Lifecycle**:

```text
        (POST /api/drafts)
       ───────────────────────►  DRAFT row exists
                                    │
              (PUT /api/drafts/:id) │ updates in place
                                    ▼
                                  DRAFT row (latest)
                                    │
                ┌───────────────────┼───────────────────┐
                │                                       │
   (DELETE /api/drafts/:id)              (POST /api/drafts/:id/submit)
                │                                       │
                ▼                                       ▼
              gone                          new IDEA row in SUBMITTED;
                                            DRAFT row deleted (same txn)
```

**Authorisation**: every draft endpoint asserts
`session.userId === draft.authorId`; failures return
`DRAFT_FORBIDDEN` (HTTP 403) or `DRAFT_NOT_FOUND` (HTTP 404 — used
for both "does not exist" and "exists but not yours" so existence is
not leaked).

**Submit pipeline** (`draftService.submit(draftId, actor)`):

1. Load + assert ownership.
2. Run `SubmitDraftSchema` (same required fields as a brand-new
   submission — title 3..120, description 20..5 000, category
   selected, all required category fields present per Phase-2
   `validateAnswers`).
3. Within a single SQLite transaction:
   1. INSERT new `ideas` row with `status = 'SUBMITTED'`,
      `anonymous = effectiveAnonymity(category, override)`.
   2. INSERT `status_transitions` row `(SUBMITTED → SUBMITTED, actor =
      author)` mirroring the Phase-1 create-time audit.
   3. DELETE the `idea_drafts` row.
   4. (Optional) move any draft-only attachment row to point at the
      new idea id (uses the existing `attachments` table; see
      Phase-1 attachment service).
4. Emit security event `idea_submitted_from_draft`.

---

## 3. Entity — `RatingDimension` and `Rating`

```ts
type RatingDimension = {
  id:          string;
  categoryId:  string | null;     // null => default set
  label:       string;
  description: string | null;
  position:    number;
  required:    boolean;
  active:      boolean;
};

type Rating = {
  id:          string;
  ideaId:      string;
  evaluatorId: string;
  dimensionId: string;
  score:       1 | 2 | 3 | 4 | 5 | null;  // null = explicitly unrated
  lockedAt:    string | null;             // ISO; set on the evaluator's decision
  createdAt:   string;
  updatedAt:   string;
};
```

**Resolving dimensions for an idea**:

```text
ideaDimensions(idea) =
   rows = rating_dimensions WHERE category_id = idea.category_id AND active = 1
   if rows.length > 0: return rows ORDER BY position
   else: return rating_dimensions WHERE category_id IS NULL AND active = 1 ORDER BY position
```

A removed dimension is `active = 0`; old ratings keep their FK to the
inactive dimension and render with `(deprecated)` suffix on the
history tab.

**Rating PUT contract** (`PUT /api/ideas/:id/ratings`):

```ts
const RatingPutSchema = z.object({
  scores: z.array(z.object({
    dimensionId: z.string(),
    score:       z.union([z.literal(null), z.literal(1), z.literal(2),
                           z.literal(3), z.literal(4), z.literal(5)]),
  })).max(20),
});
```

The service upserts one row per `(idea, evaluator, dimensionId)`.
Submitted dimension ids MUST belong to the idea's resolved dimension
set; unknown ids → `RATING_INVALID_SCORE`. Rows whose `lockedAt` is
non-null reject any update → `RATING_LOCKED` (HTTP 409).

**Required-dimension gate** (`canDecide(idea, evaluator)`):

```ts
function canDecide(idea, evaluator): { ok: true } | { ok: false, missing: string[] } {
  const required = ideaDimensions(idea).filter(d => d.required);
  const myScores = ratings.where(r => r.ideaId === idea.id && r.evaluatorId === evaluator.id);
  const missing = required
    .filter(d => !myScores.find(r => r.dimensionId === d.id && r.score !== null))
    .map(d => d.label);
  return missing.length === 0 ? { ok: true } : { ok: false, missing };
}
```

Failure on Approve/Reject returns `RATING_REQUIRED_MISSING` (HTTP
422) with `details: { missing: string[] }`. **No state transition
fires.**

**Lock-on-decide** (in `ideaService.decide(idea, decision, actor)`):

```ts
// inside the same transaction that writes the SUBMITTED → APPROVED|REJECTED
// status_transitions row:
update ratings
   set locked_at = now()
 where idea_id = idea.id and evaluator_id = actor.id and locked_at is null;
```

---

## 4. Entity — `Comment`

```ts
type Comment = {
  id:                string;
  ideaId:            string;
  authorId:          string;
  authorRoleAtPost:  Role;
  parentId:          string | null;
  kind:              'COMMENT' | 'DECISION';
  body:              string;        // plain text; rendered with escapeAndLinebreak
  createdAt:         string;
  editedAt:          string | null;
  deletedAt:         string | null;
  deletedById:       string | null;
};
```

**POST contract** (`POST /api/ideas/:id/comments`):

```ts
const CommentPostSchema = z.object({
  body:     z.string().trim().min(1).max(2_000),
  parentId: z.string().uuid().optional(),
});
```

Service rules:

- If `parentId` present, load the parent. If `parent.parentId !== null`
  → `COMMENT_NESTING_EXCEEDED` (HTTP 422).
- Author is `session.userId`; `authorRoleAtPost = session.role`.
- Visibility: viewer MUST be the idea's author, an EVALUATOR who has
  rated or commented on the idea, or an ADMIN. Anything else →
  `COMMENT_FORBIDDEN` (HTTP 403).
- Comments on an idea in a terminal status remain *postable* (per
  spec edge-case bullet 7) but do not trigger any state transition.
- Decision comment: when `ideaService.decide()` fires, it inserts a
  top-level `comments` row with `kind = 'DECISION'` and the decision
  comment text as `body`.

**PATCH contract** (`PATCH /api/ideas/:id/comments/:commentId`):

- Author may edit their own comment within 5 minutes of `createdAt`.
  After that → `COMMENT_EDIT_WINDOW_EXPIRED` (HTTP 409).
- Body validated by `CommentPostSchema.shape.body`.
- Sets `edited_at = now()`.

**DELETE contract** (`DELETE /api/ideas/:id/comments/:commentId`):

- Author may delete their own within 5 minutes (hard delete).
- ADMIN may soft-delete any: sets `deleted_at`, `deleted_by_id`;
  body is replaced in the read projection with
  `"[comment removed by moderator]"`.

---

## 5. Entity — `Anonymity`

```ts
type AnonymitySource = 'CATEGORY_DEFAULT' | 'ADMIN_OVERRIDE';

type AnonymityState = {
  ideaId:        string;
  anonymous:     boolean;
  source:        AnonymitySource;
  // for audit / admin UI only; never exposed to evaluators
};
```

`effectiveAnonymity(category, override)`:

```ts
function effectiveAnonymity(category, override?: boolean): boolean {
  if (override === undefined) return category.anonymousDefault;
  return override;  // Admin-only path; route handler asserts caller.role === 'ADMIN'
}
```

`maskAuthor(idea, viewer)` — the single anonymity projection:

```ts
function maskAuthor(idea: IdeaWithAuthor, viewer: Session): IdeaWithAuthor {
  const hide =
    idea.anonymous &&
    viewer.role === 'EVALUATOR' &&
    viewer.userId !== idea.authorId;

  if (!hide) return idea;

  return {
    ...idea,
    author: {
      id:        null,
      name:      'Anonymous Submitter',
      email:     null,
      avatarUrl: null,
    },
  };
}
```

Applied in:

- `idea-listing.ts` (queue + my-ideas — note: a submitter viewing
  their own anonymous idea on `my-ideas` is `viewer.userId ===
  idea.authorId`, so they see themselves).
- `idea-detail` server action.
- `comment-service.ts` (`maskComment` reuses `maskAuthor` for
  comments whose `authorId === idea.authorId`).
- `idea-history.ts` (the Phase-3 history folder, extended).
- `insights-service.ts` tooltips (chart tooltips never include
  per-submitter detail in the EVALUATOR projection at all — see §6).

The Phase-1/2/3 audit log is **never** masked: every audit row
records the real `actorId`. Anonymity is a viewer projection only.

---

## 6. Entity — Insights (logical, not persisted)

```ts
type InsightsRange = {
  from:   string;   // ISO yyyy-mm-dd
  to:     string;   // ISO yyyy-mm-dd
  bucket: 'day' | 'week' | 'month';
};

type SubmissionTrendPoint = { bucket: string; count: number };
type ApprovalRateSummary  = { approved: number; rejected: number; pending: number; rate: number /* 0..1 */; series: SubmissionTrendPoint[] };
type CategoryDistribution = { categoryId: string; categoryName: string; count: number; share: number /* 0..1 */ };
```

**Endpoints**:

| Endpoint | Role | Query | Returns |
|---|---|---|---|
| `GET /api/insights/trend?from&to&bucket` | EVALUATOR, ADMIN | `SELECT bucket(created_at), count(*) FROM ideas WHERE created_at BETWEEN ? AND ? GROUP BY 1` | `SubmissionTrendPoint[]` |
| `GET /api/insights/approval-rate?from&to&bucket` | EVALUATOR, ADMIN | aggregate over `status_transitions` where `from = 'UNDER_REVIEW'` and `to ∈ {APPROVED, REJECTED}` | `ApprovalRateSummary` |
| `GET /api/insights/category-distribution?from&to` | EVALUATOR, ADMIN | `SELECT category_id, count(*) FROM ideas WHERE created_at BETWEEN ? AND ? AND status != 'DRAFT' GROUP BY 1` | `CategoryDistribution[]` |

All three endpoints return `{ data: [...], range: InsightsRange,
generatedAt: ISOString }`. EMPLOYEE access → `INSIGHTS_FORBIDDEN`
(HTTP 403). EVALUATOR access never includes a per-submitter
breakdown in the response shape (the field simply does not exist —
the type system prevents accidental disclosure).

Range validation (`InsightsRangeSchema`):

- `from <= to`.
- `to - from <= 730 days` (2 years).
- `bucket` MUST be consistent with range length (`day` for ≤ 90
  days, `week` for ≤ 365 days, `month` otherwise) — server clamps
  with a warning header rather than rejecting.

---

## 7. Read paths affected — anonymity cheat-sheet

| Surface | Reads | Masking applied? |
|---|---|---|
| Reviewer queue (Phase 3 listing) | `idea-listing.ts` | YES (per-row) |
| Reviewer idea detail | RSC page | YES |
| Reviewer comment thread | `comment-service.ts` | YES (per-comment, if comment author === idea author) |
| Reviewer history tab | `idea-history.ts` | YES (per-event, if event actor === idea author) |
| Employee my-ideas | `idea-listing.ts` | NO (viewer is author) |
| Employee idea detail | RSC page | NO (viewer is author) |
| Employee dashboard History tab (FR-037) | `idea-listing.ts` scoped to `authorId = session.userId` and `status IN ('APPROVED','REJECTED','IMPLEMENTED')` | NO (viewer is author) |
| Admin everything | every read | NO |
| Insights — EVALUATOR | aggregator endpoints | n/a — response shape excludes per-submitter fields |
| Insights — ADMIN | aggregator endpoints | n/a — per-submitter fields included (real names) |

The contract test `anonymity-projection.test.ts` enumerates every
EVALUATOR-facing endpoint and asserts SC-005.

---

## 8. Hardening — read shapes (no new tables)

### FR-037 — Employee dashboard History tab

A view computed by `idea-listing.ts` with:

```ts
const HISTORY_QUERY: ListingQuery = {
  scope:    'mine',
  status:   ['APPROVED', 'REJECTED', 'IMPLEMENTED'],
  page:     1,
  pageSize: 20,
  q:        '',
};
```

Renders the existing `IdeaSummary` shape with two additional columns
synthesised in the page (not the wire format): `concludedAt`
(= `status_transitions.recorded_at` for the most recent terminal
transition) and `decisionLabel` (= the final status).

### FR-038 — Reviewer review-queue status filter

The reviewer queue page changes its `availableStatuses` constant from
the Phase-3 broken value to:

```ts
const QUEUE_STATUSES = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'IMPLEMENTED'] as const;
```

`useListingQuery` already URL-binds `status[]=…` and treats an empty
array as "no filter". The bug was in the page-level filter
component, which previously hard-coded a subset and treated "none
selected" as "match nothing". Fix is in
`src/components/ideas/idea-filter-bar.tsx` (the Phase-3 component is
modified, not re-implemented). The empty-state component receives an
`isFiltered` boolean so it can render "No ideas match this filter"
vs. "Queue is empty" distinctly.

Both hardening fixes are covered by integration tests
(`employee-history-tab.test.ts`, `queue-status-filter.test.ts`) and
asserted in the Playwright E2E
`reviewer-rate-and-comment.spec.ts` (which navigates the queue
through several filter combinations on the way to the rating panel).
