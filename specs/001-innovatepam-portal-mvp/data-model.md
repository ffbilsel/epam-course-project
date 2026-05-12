# Phase 1 Data Model — InnovatEPAM Portal MVP

Authoritative entity definitions, derived from spec.md FR-001…FR-028.
Implemented via Drizzle ORM in `src/db/schema.ts`; SQLite is the
storage engine.

## Conventions

- **IDs**: `TEXT` UUID v4 (`crypto.randomUUID()`), generated in app code
  for portability across drivers.
- **Timestamps**: stored as `INTEGER` Unix-epoch ms (SQLite has no
  native TIMESTAMP); converted to/from `Date` in repositories.
- **String enums**: stored as `TEXT` with a CHECK constraint listing the
  allowed values. The same enums are exported from `src/db/schema.ts`
  as TypeScript const-objects + union types.
- **Foreign keys**: `ON DELETE` is **RESTRICT** by default (we never
  hard-delete users or ideas in Phase 1). Exceptions noted per table.
- **Soft delete**: not used in Phase 1.
- **Naming**: snake_case in SQL, camelCase in TypeScript; Drizzle
  handles the mapping.

---

## Entity: User

Authenticated principal.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `email` | TEXT, UNIQUE (case-insensitive), NOT NULL | Lowercased on write. |
| `passwordHash` | TEXT, NOT NULL | argon2id hash (see R-002). |
| `displayName` | TEXT, NOT NULL | 1–80 chars. |
| `role` | TEXT, NOT NULL, CHECK in `('EMPLOYEE','EVALUATOR','ADMIN')` | Default `'EMPLOYEE'`. |
| `createdAt` | INTEGER, NOT NULL | Unix ms. |
| `updatedAt` | INTEGER, NOT NULL | Unix ms; bumped on role change. |

**Indexes**: `idx_users_email_lower` on `lower(email)`.

**Invariants** (enforced in `user-service` / `role-service`):
- Email uniqueness is case-insensitive (FR-002).
- A demotion is rejected if the actor is the last `ADMIN` (FR-005a).
- Bootstrap admin promotion runs on each app start; idempotent
  (FR-005b).

**Related FRs**: FR-001, FR-002, FR-005, FR-005a, FR-005b, FR-026.

---

## Entity: Session (NextAuth-managed)

Owned by NextAuth's drizzle adapter — table shape per the adapter's
contract: `id`, `userId`, `expires`, `sessionToken`. We expose a
single rule on top: every successful authenticated request bumps
`expires` to `now + 24h` (FR-004). Implemented in `auth-options.ts`'s
`session` callback.

---

## Entity: Category

Classification an Idea belongs to.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `name` | TEXT, NOT NULL | 1–40 chars, unique case-insensitively. |
| `state` | TEXT, NOT NULL, CHECK in `('ACTIVE','PROPOSED','REJECTED')` | |
| `proposedById` | UUID, FK → users(id), NULL | NULL for seeded categories. |
| `decidedById` | UUID, FK → users(id), NULL | Filled when state leaves `PROPOSED`. |
| `decidedAt` | INTEGER, NULL | Filled when state leaves `PROPOSED`. |
| `createdAt` | INTEGER, NOT NULL | |
| `isProtected` | INTEGER (0/1), NOT NULL, DEFAULT 0 | `1` for `Other` only — guards delete. |

**Indexes**: `uniq_categories_name_lower` on `lower(name)`;
`idx_categories_state` on `state`.

**State machine**:

```
            propose                   approve
SUBMITTED ────────►  PROPOSED ─────────────────► ACTIVE
                       │
                       └────────────►  REJECTED
                            reject
                            (linked ideas → Other)
```

(Note: `SUBMITTED` here refers to the **Idea** that triggered the
proposal; the Category itself starts at `PROPOSED`.)

**Invariants** (enforced in `category-service`):
- Name uniqueness is case-insensitive across all states.
- `Other` is seeded with `isProtected = 1` and cannot transition.
- Reject runs in one DB transaction with the re-link of every Idea
  to `Other` (FR-008c).

**Seed** (`src/db/seed.ts`): Process Improvement, Product Innovation,
Tooling, Customer Experience, Other (the last is `isProtected = 1`).

**Related FRs**: FR-008, FR-008a, FR-008b, FR-008c, FR-008d, FR-022a.

---

## Entity: Idea

A creative submission by an Employee.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `authorId` | UUID, FK → users(id), NOT NULL | Immutable after create. |
| `title` | TEXT, NOT NULL | 1–120 chars. |
| `description` | TEXT, NOT NULL | 1–2000 chars. |
| `categoryId` | UUID, FK → categories(id), NOT NULL | May change only when its category is REJECTED → re-linked to `Other`. |
| `status` | TEXT, NOT NULL, CHECK in `('SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','IMPLEMENTED')` | Default `'SUBMITTED'`. |
| `attachmentId` | UUID, FK → attachments(id), NULL | At most one (FR-009). |
| `createdAt` | INTEGER, NOT NULL | |
| `updatedAt` | INTEGER, NOT NULL | Bumped on every transition. |

**Indexes**:
- `idx_ideas_author_updated` on `(authorId, updatedAt DESC)` —
  powers "My Ideas" sort (FR-015).
- `idx_ideas_status` on `status` — powers the review-queue filter
  (FR-017).
- `idx_ideas_category` on `categoryId` — powers the category-reject
  re-link.

**State machine** (FR-021, expanded with rules from FR-019a, FR-022,
FR-022a):

```
                          start review
   ┌────────────────────────────────────────────┐
   │                                            ▼
SUBMITTED ──approve──►  APPROVED ──implement──► IMPLEMENTED
   │   │                  ▲
   │   └─reject──► REJECTED
   │                      ▲
   ▼                      │
UNDER_REVIEW ──approve────┤
              ──reject────┘
```

| From | To | Allowed when |
|---|---|---|
| SUBMITTED | UNDER_REVIEW | actor.role ∈ {EVALUATOR, ADMIN}, actor ≠ author, idea.category.state = ACTIVE |
| SUBMITTED | APPROVED | same as above + non-empty comment |
| SUBMITTED | REJECTED | same as above + non-empty comment |
| UNDER_REVIEW | APPROVED | same as above + non-empty comment |
| UNDER_REVIEW | REJECTED | same as above + non-empty comment |
| APPROVED | IMPLEMENTED | actor.role = ADMIN, actor ≠ author |

Any other transition → `IDEA_INVALID_TRANSITION` (HTTP 409).

**Invariants** (enforced in `idea-service` + `idea-state-machine`):
- `authorId` is immutable.
- `attachmentId` may be set at create or unset (one-way) by author
  during a future "edit" flow — Phase 1 only sets it at create.
- A status transition writes both `Idea.status += updatedAt` AND a
  `StatusTransition` row in the same SQLite transaction.

**Related FRs**: FR-007, FR-008–FR-013, FR-014–FR-016, FR-017–FR-024.

---

## Entity: Attachment

A single supporting file linked to an Idea.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `ideaId` | UUID, FK → ideas(id), NOT NULL, **ON DELETE CASCADE** | Idea-attachment lifecycle is bound. |
| `originalName` | TEXT, NOT NULL | Sanitised; 1–255 chars. |
| `storedPath` | TEXT, NOT NULL | Relative to `./data/uploads/`. |
| `mimeType` | TEXT, NOT NULL | One of the allow-list (FR-010). |
| `sizeBytes` | INTEGER, NOT NULL | ≤ 25 × 1024 × 1024. |
| `uploadedAt` | INTEGER, NOT NULL | |

**Indexes**: `uniq_attachments_idea` UNIQUE on `ideaId` (one
attachment per idea).

**Invariants** (enforced in `attachment-service`):
- `mimeType` is verified by reading the file's first 4 KB
  (`file-type` package), not trusted from the client header.
- The file lives at `./data/uploads/<ideaId>/<id>__<originalName>`;
  the `storedPath` column persists the *relative* path so the upload
  root can be moved.
- A "stage → commit" flow keeps storage and DB consistent (R-006);
  startup sweeper deletes anything in `./data/uploads/.staging/`
  older than 1 hour.

**Related FRs**: FR-009, FR-010, FR-011, SC-007.

---

## Entity: StatusTransition

Append-only audit log of every Idea status change. Supersedes the
"Decision" entity from spec.md (broader because it covers
Start-review and Mark-implemented as well).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID, PK | |
| `ideaId` | UUID, FK → ideas(id), NOT NULL | |
| `actorId` | UUID, FK → users(id), NOT NULL | |
| `fromState` | TEXT, NOT NULL, CHECK ∈ Idea.status enum | |
| `toState` | TEXT, NOT NULL, CHECK ∈ Idea.status enum | |
| `comment` | TEXT, NULL | Required for APPROVED/REJECTED transitions; optional otherwise. |
| `recordedAt` | INTEGER, NOT NULL | |

**Indexes**: `idx_transitions_idea_recorded` on `(ideaId, recordedAt
DESC)`.

**Invariants** (enforced in `transition-repo` + `idea-state-machine`):
- The pair `(fromState, toState)` MUST be in the allowed-transitions
  table above.
- For `APPROVED` / `REJECTED` `toState`, `comment` MUST be non-empty
  after `String#trim()`.

**Related FRs**: FR-018a, FR-019, FR-019a, FR-020, FR-021, FR-022,
FR-028.

---

## Cross-cutting derived views

These are not separate tables; they are queries the services expose.

- **My Ideas** (`idea-service.listMine(authorId)`): Ideas where
  `authorId = $1`, ordered by `updatedAt DESC`. Powers FR-014/015.
- **Review queue** (`idea-service.listPending()`): Ideas where
  `status IN ('SUBMITTED','UNDER_REVIEW')`, ordered by `createdAt
  ASC`. Powers FR-017.
- **Idea history** (`transition-repo.listByIdea(ideaId)`): all
  StatusTransitions for an idea, ordered by `recordedAt ASC`.
  Powers FR-018.

---

## Error-code surface (for Phase 1)

Every code below MUST appear in `src/lib/errors/codes.ts` and in at
least one test (gate #9). HTTP status mapping follows Principle VII.3.

| Code | HTTP | Origin |
|---|---|---|
| `AUTH_INVALID_CREDENTIALS` | 401 | login |
| `AUTH_SESSION_EXPIRED` | 401 | middleware |
| `AUTH_FORBIDDEN_ROLE` | 403 | role guard |
| `AUTH_LAST_ADMIN_DEMOTION` | 409 | role-service |
| `USER_EMAIL_TAKEN` | 409 | register |
| `USER_PASSWORD_POLICY` | 400 | register |
| `IDEA_TITLE_REQUIRED` | 400 | submit |
| `IDEA_TITLE_TOO_LONG` | 400 | submit |
| `IDEA_DESCRIPTION_REQUIRED` | 400 | submit |
| `IDEA_DESCRIPTION_TOO_LONG` | 400 | submit |
| `IDEA_CATEGORY_INVALID` | 400 | submit (unknown id or duplicate proposed name) |
| `IDEA_CATEGORY_PENDING` | 409 | transition while category PROPOSED |
| `IDEA_NOT_FOUND` | 404 | any idea route |
| `IDEA_INVALID_TRANSITION` | 409 | state machine |
| `IDEA_COMMENT_REQUIRED` | 400 | approve/reject |
| `IDEA_ALREADY_DECIDED` | 409 | concurrent decision |
| `IDEA_SELF_EVALUATION_FORBIDDEN` | 403 | author == actor |
| `ATTACHMENT_TOO_LARGE` | 413 | upload |
| `ATTACHMENT_TYPE_NOT_ALLOWED` | 400 | upload (sniff failed) |
| `ATTACHMENT_NOT_FOUND` | 404 | download |
| `CATEGORY_NAME_TAKEN` | 409 | propose new |
| `CATEGORY_NOT_FOUND` | 404 | approve/reject |
| `CATEGORY_NOT_PENDING` | 409 | approve/reject on non-PROPOSED |
| `CATEGORY_PROTECTED` | 409 | attempt to delete/reject `Other` |
| `RATE_LIMITED` | 429 | login + upload |
| `INTERNAL_ERROR` | 500 | unhandled boundary |
