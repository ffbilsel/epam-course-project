# Phase 1 — Data Model: Idea Listing & Management Enhancements

**Feature**: `003-idea-listing-management`  
**Date**: 2026-05-14  
**Inputs**: [plan.md](./plan.md), [research.md](./research.md), Phase 1/2 schema in `src/db/schema.ts`.

This document defines the **runtime shapes** introduced by Phase 3.
No new database tables are created. The only physical schema change is
the migration `drizzle/0002_listing_and_edits.sql` (CHECK widen + one
composite index, both described in [research.md §3](./research.md)).

---

## 1. Listing query (`ListingQuery`)

Single Zod schema validated by `src/lib/validation/idea.ts` and re-used by:

- `GET /api/ideas` (page + export both)
- `GET /api/ideas/export`
- All listing RSC pages (employee, reviewer, admin)

```ts
const ListingQuery = z.object({
  scope:      z.enum(['mine', 'queue', 'all']),
  q:          z.string().trim().max(200).default(''),
  categoryId: z.string().uuid().optional(),
  status:     z.array(z.enum(IDEA_STATUS_VALUES)).max(5).optional(),
  from:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page:       z.coerce.number().int().min(1).default(1),
  pageSize:   z.union([z.literal(20), z.literal(50), z.literal(100)]).default(20),
});
type ListingQuery = z.infer<typeof ListingQuery>;
```

**Server scope rule** (`src/server/idea-listing.ts`):

| `scope` | Visible rows |
|---|---|
| `mine` | `ideas.authorId = session.userId` |
| `queue` | `ideas.status IN ('SUBMITTED','UNDER_REVIEW')` AND session role ∈ `{reviewer, admin}` |
| `all` | unrestricted, session role = `admin` |

Validation errors:

- `q.length > 200` ⇒ `IDEA_LISTING_SEARCH_TOO_LONG`
- `from > to` or invalid date ⇒ `IDEA_LISTING_RANGE_INVALID`
- `pageSize` not in `{20, 50, 100}` ⇒ `IDEA_LISTING_PAGE_INVALID`
- `page > Math.ceil(total / pageSize)` ⇒ **not** an error; clamp to last page, set `Cache-Control: no-store`, include `currentPage` in the response.

---

## 2. Listing response (`ListingPage<IdeaSummary>`)

```ts
type IdeaSummary = {
  id:           string;
  title:        string;
  status:       IdeaStatus;
  categoryId:   string;
  categoryName: string;
  authorId:     string;
  authorName:   string;
  createdAt:    string;  // ISO-8601 UTC
  updatedAt:    string;
};

type ListingPage<T> = {
  rows:         T[];
  total:        number;
  page:         number;
  pageSize:     20 | 50 | 100;
  totalPages:   number;
};
```

`IdeaSummary` is a deliberately narrow projection — no description,
no answers, no attachment metadata — so the listing wire payload is
small (target ≤ 1 KB / row).

---

## 3. Edit / delete state diagram

```text
                   ┌───────────┐
                   │ SUBMITTED │  ← author may PATCH or DELETE
                   └────┬──────┘
                        │ reviewer START_REVIEW
                        ▼
                ┌───────────────┐
                │ UNDER_REVIEW  │  ← edit/delete LOCKED (409 IDEA_NOT_EDITABLE)
                └──┬─────────┬──┘
                   │         │
        APPROVE ◄──┘         └──► REJECT
                   │         │
             ┌─────▼──┐   ┌──▼──────┐
             │APPROVED│   │REJECTED │      ← terminal for author
             └────┬───┘   └─────────┘
                  │ IMPLEMENT
                  ▼
            ┌──────────────┐
            │ IMPLEMENTED  │              ← terminal
            └──────────────┘
```

Authoritative guard (`idea-state-machine.ts`):

```ts
function canAuthorEdit(idea: Idea, actor: Session): boolean {
  return actor.userId === idea.authorId && idea.status === 'SUBMITTED';
}
function canAuthorDelete(idea: Idea, actor: Session): boolean {
  return actor.userId === idea.authorId && idea.status === 'SUBMITTED';
}
```

Service error mapping:

| Condition | Code | HTTP |
|---|---|---|
| Not author | `FORBIDDEN` | 403 |
| Status ≠ `SUBMITTED`, PATCH | `IDEA_NOT_EDITABLE` | 409 |
| Status ≠ `SUBMITTED`, DELETE | `IDEA_NOT_DELETABLE` | 409 |
| Not found / soft-hidden | `IDEA_NOT_FOUND` | 404 |

---

## 4. Edit payload (`UpdateIdeaInput`)

```ts
const UpdateIdeaSchema = z.object({
  title:        z.string().trim().min(3).max(120),
  description:  z.string().trim().min(20).max(5_000),
  categoryId:   z.string().uuid(),
  answers:      AnswerArraySchema,        // Phase-2 shape, unchanged
  // attachment changes happen via the existing multipart endpoint;
  // PATCH only touches structured fields.
});
```

`editIdea(ideaId, input, actor)`:

1. Load idea; assert `canAuthorEdit`.
2. Validate `answers` against the **current** category's schema (Phase-2 `validateAnswers`).
3. Inside a single transaction:
   1. UPDATE `ideas` row, bump `updated_at`.
   2. DELETE prior `idea_answers` for the idea; INSERT new ones.
   3. INSERT a `status_transitions` row with `from = to = SUBMITTED`, actor = author, comment = `null`.
4. Emit security event `idea_edited { ideaId, actorId }`.

---

## 5. History event (`IdeaHistoryEvent`)

```ts
type IdeaHistoryEvent =
  | { kind: 'SUBMITTED'; at: string; actorId: string; actorName: string; }
  | { kind: 'EDITED';    at: string; actorId: string; actorName: string; comment: string | null; }
  | { kind: 'TRANSITION'; at: string; actorId: string; actorName: string; from: IdeaStatus; to: IdeaStatus; comment: string | null; };
```

`getIdeaHistory(ideaId, actor)`:

1. Authorise: any signed-in user may read history of *their own* idea; reviewers may read history of any idea in their queue; admins read any.
2. Read `ideas.createdAt`, `ideas.authorId`, `users.fullName`.
3. Read `status_transitions WHERE idea_id = ?` ordered by `recorded_at ASC`.
4. Map rows where `from = to` to `kind: 'EDITED'`, others to `kind: 'TRANSITION'`.
5. Prepend the synthesised `SUBMITTED` event.

Output is always non-empty (at least the `SUBMITTED` event).

---

## 6. CSV export row (`IdeaExportRow`)

Columns, in order — header row is identical:

```text
id,title,status,category,author_email,created_at,updated_at,latest_decision_at,latest_decision_actor,latest_decision_comment
```

- `created_at`, `updated_at`, `latest_decision_at` — ISO-8601 UTC.
- `latest_decision_*` — populated when the idea's status is `APPROVED`, `REJECTED`, or `IMPLEMENTED`, taken from the most recent `status_transitions` row where `from != to`. Empty strings otherwise.
- Fields are RFC 4180 escaped by `csv.ts`.

The export endpoint streams `header\n` followed by rows pulled in batches of 500 from a Drizzle iterator over the listing query (without `LIMIT/OFFSET`, ordered by `created_at DESC` for stable output).

---

## 7. Migration delta

`drizzle/0002_listing_and_edits.sql`:

```sql
-- 1. Widen status_transitions CHECK to allow from = to = EDITED-marker.
-- SQLite cannot ALTER a CHECK in place; do it via the standard
-- create-new / copy / rename dance, all in one transaction.
PRAGMA foreign_keys = OFF;

CREATE TABLE status_transitions_new (
  id           TEXT PRIMARY KEY,
  idea_id      TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  actor_id     TEXT NOT NULL REFERENCES users(id),
  from_state   TEXT NOT NULL,
  to_state     TEXT NOT NULL,
  comment      TEXT,
  recorded_at  INTEGER NOT NULL,
  CHECK (
    from_state IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED')
    AND to_state IN ('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED')
  )
);

INSERT INTO status_transitions_new
SELECT id, idea_id, actor_id, from_state, to_state, comment, recorded_at
FROM status_transitions;

DROP TABLE status_transitions;
ALTER TABLE status_transitions_new RENAME TO status_transitions;

CREATE INDEX idx_status_transitions_idea_recorded
  ON status_transitions(idea_id, recorded_at);

PRAGMA foreign_keys = ON;

-- 2. Listing index.
CREATE INDEX IF NOT EXISTS idx_ideas_search
  ON ideas(status, category_id, created_at);
```

The CHECK now lists only the five lifecycle states; the `from = to`
edit-marker case is allowed naturally because both sides are members
of that set. Per [ADR-0015](./adr/0015-edited-audit-row.md), the
discriminator `from = to` is enforced by code on the write side.

---

## 8. Type re-exports (`src/types/index.ts`)

Add: `ListingQuery`, `ListingPage`, `IdeaSummary`, `UpdateIdeaInput`, `IdeaHistoryEvent`, `IdeaExportRow`.
