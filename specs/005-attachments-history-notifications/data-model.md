# Phase 1 — Data Model: Attachments, Version History & Notifications

**Feature**: `005-attachments-history-notifications`
**Date**: 2026-05-14
**Inputs**: [plan.md](./plan.md), [research.md](./research.md),
existing schema in `src/db/schema.ts` (Phase 1–4).

This document defines the **runtime shapes** introduced by Phase 5
and the migration that backs them. Four new tables, one new column
on `attachments`, one dropped index. Zero changes to the idea state
machine grammar, zero changes to roles, zero changes to anonymity
semantics (reused unchanged).

---

## 1. Schema delta

`drizzle/0004_attachments_history_notifications.sql`:

```sql
PRAGMA foreign_keys = OFF;
BEGIN;

-- (1) attachments — drop single-attachment uniqueness, add display_order
DROP INDEX IF EXISTS uniq_attachments_idea;
ALTER TABLE attachments
  ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_attachments_idea_order
  ON attachments(idea_id, display_order);

-- (2) New table: idea_versions (append-only whole snapshots)
CREATE TABLE idea_versions (
  id               TEXT PRIMARY KEY,
  idea_id          TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  version_no       INTEGER NOT NULL,
  actor_id         TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at       INTEGER NOT NULL,
  title            TEXT NOT NULL,
  description      TEXT NOT NULL,
  category_id      TEXT REFERENCES categories(id) ON DELETE SET NULL,
  category_answers TEXT NOT NULL DEFAULT '[]',
  attachment_ids   TEXT NOT NULL DEFAULT '[]',
  UNIQUE (idea_id, version_no)
);
CREATE INDEX idx_idea_versions_idea_created
  ON idea_versions(idea_id, created_at);

-- (3) New table: notification_events
CREATE TABLE notification_events (
  id            TEXT PRIMARY KEY,
  recipient_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id      TEXT REFERENCES users(id) ON DELETE SET NULL,
  idea_id       TEXT REFERENCES ideas(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN (
                  'STATUS_CHANGED','COMMENT_ADDED','RATING_ADDED',
                  'REPLY_ON_REVIEW','BULK_DIGEST')),
  payload       TEXT NOT NULL,   -- JSON; anonymity already applied
  created_at    INTEGER NOT NULL,
  read_at       INTEGER
);
CREATE INDEX idx_notifications_recipient_created
  ON notification_events(recipient_id, created_at);
-- Partial index for the badge query (SQLite supports WHERE in CREATE INDEX).
CREATE INDEX idx_notifications_recipient_unread
  ON notification_events(recipient_id) WHERE read_at IS NULL;

-- (4) New table: email_deliveries
CREATE TABLE email_deliveries (
  id               TEXT PRIMARY KEY,
  event_id         TEXT NOT NULL REFERENCES notification_events(id)
                     ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                     'pending','sent','failed','suppressed')),
  attempt_count    INTEGER NOT NULL DEFAULT 0,
  last_error       TEXT,
  last_attempt_at  INTEGER,
  next_attempt_at  INTEGER,
  created_at       INTEGER NOT NULL
);
CREATE INDEX idx_email_deliveries_due
  ON email_deliveries(status, next_attempt_at);

-- (5) New table: email_preferences
CREATE TABLE email_preferences (
  user_id                      TEXT PRIMARY KEY
                                 REFERENCES users(id) ON DELETE CASCADE,
  status_changes               INTEGER NOT NULL DEFAULT 1
                                 CHECK (status_changes IN (0, 1)),
  comments_on_my_ideas         INTEGER NOT NULL DEFAULT 1
                                 CHECK (comments_on_my_ideas IN (0, 1)),
  ratings_on_my_ideas          INTEGER NOT NULL DEFAULT 1
                                 CHECK (ratings_on_my_ideas IN (0, 1)),
  replies_on_ideas_i_review    INTEGER NOT NULL DEFAULT 1
                                 CHECK (replies_on_ideas_i_review IN (0, 1)),
  updated_at                   INTEGER NOT NULL
);

-- (6) Back-fill idea_versions.v1 for every existing idea.
INSERT INTO idea_versions (id, idea_id, version_no, actor_id, created_at,
                           title, description, category_id, category_answers,
                           attachment_ids)
SELECT
  lower(hex(randomblob(16))),
  i.id, 1, i.author_id, i.created_at,
  i.title, i.description, i.category_id, i.category_answers,
  IFNULL((
    SELECT '[' || group_concat('"' || a.id || '"', ',') || ']'
    FROM (SELECT id FROM attachments
          WHERE idea_id = i.id
          ORDER BY display_order, uploaded_at) a
  ), '[]')
FROM ideas i;

-- (7) Back-fill subsequent versions from Phase-3 EDITED audit rows.
-- The audit row encodes the post-edit values in its `comment` JSON
-- (Phase-3 schema). For rows that predate the JSON-encoded format we
-- fall back to the *current* idea values keyed on the audit timestamp.
-- Implementation detail handled in TypeScript inside migrate.ts to keep
-- the SQL portable and observable; left as a no-op SQL block here.

COMMIT;
PRAGMA foreign_keys = ON;
```

> **Notes on the migration**
> - The SQL above is the canonical, declarative half. The data-only
>   step (7) is performed by `tsx src/db/migrate.ts` immediately
>   after `drizzle-kit` applies the structural half, so the audit
>   parsing lives in TypeScript where it is unit-testable. Both halves
>   run inside the same `db:migrate` invocation.
> - The legacy `attachments.uniq_attachments_idea` index is dropped
>   in step (1). Existing rows keep their `display_order = 0`; the
>   first new attachment added to an idea uses `display_order = 1`.

---

## 2. Entity — `AttachmentSummary` (refined)

```ts
type AttachmentSummary = {
  id:            string;
  ideaId:        string | null;          // null while staged pre-save
  originalName:  string;
  mimeType:      string;
  sizeBytes:     number;
  displayOrder:  number;                 // 0-based, dense within idea
  uploadedAt:    string;                 // ISO-8601 UTC
  previewKind:   'image' | 'pdf' | 'text' | 'download'; // server-classified
};
```

`previewKind` is derived server-side from `mimeType`:

| `mimeType` prefix / value                           | `previewKind` |
|-----------------------------------------------------|---------------|
| `image/png`, `image/jpeg`, `image/gif`, `image/webp`| `image`       |
| `application/pdf`                                   | `pdf`         |
| `text/plain`, `text/markdown`, `text/*` source code | `text`        |
| everything else (incl. `image/svg+xml`)             | `download`    |

This is the **only** classification the client trusts. The client
never looks at the file extension.

---

## 3. Entity — `IdeaVersion`

```ts
type IdeaVersion = {
  id:              string;
  ideaId:          string;
  versionNo:       number;                  // 1..N
  actorId:         string;
  createdAt:       string;                  // ISO-8601 UTC
  title:           string;
  description:     string;
  categoryId:      string | null;
  categoryAnswers: AnswerEntry[];           // Phase-2 shape, unchanged
  attachmentIds:   string[];                // ordered, stable
};

type IdeaVersionSummary = Pick<
  IdeaVersion,
  'id' | 'versionNo' | 'actorId' | 'createdAt'
>;
```

**Lifecycle**:

- `v1` is INSERTed in the same transaction as the originating
  `ideas` INSERT (initial submission OR draft-submit per Phase 4).
- `v(N+1)` is INSERTed in the same transaction as each successful
  author edit.
- A deleted idea cascades to its versions (ON DELETE CASCADE) —
  satisfies NFR-004.

**Authorisation**: every version endpoint reuses the idea-detail
authorisation. `IDEA_NOT_FOUND` is returned for *any* missing-or-
forbidden access (consistent with FR-025's no-leakage rule).

---

## 4. Entity — `IdeaDiff`

The shape returned by `GET /api/ideas/[id]/versions/diff?from=&to=`:

```ts
type IdeaDiff = {
  ideaId:    string;
  fromVersionNo: number;
  toVersionNo:   number;
  fields:    IdeaDiffField[];
  truncated: boolean;            // true if any prose hit the 200 KB cap
};

type IdeaDiffField =
  | { kind: 'prose';      name: 'title' | 'description' | string;
      hunks: ProseHunk[]; changed: boolean; }
  | { kind: 'structured'; name: string;
      from: unknown; to: unknown;
      changed: boolean; }
  | { kind: 'attachments';
      added:    AttachmentSummary[];   // by id, hydrated for both versions
      removed:  AttachmentSummary[];
      reordered: boolean;
      changed:  boolean; };

type ProseHunk = {
  value: string;
  added?:   boolean;     // green
  removed?: boolean;     // red
  // unchanged when neither flag is set
};
```

`changed = false` fields are present so the UI can list "unchanged
fields" without re-querying; the client collapses them by default
(FR-024).

---

## 5. Entity — `NotificationEvent`

```ts
type NotificationKind =
  | 'STATUS_CHANGED'
  | 'COMMENT_ADDED'
  | 'RATING_ADDED'
  | 'REPLY_ON_REVIEW'
  | 'BULK_DIGEST';

type NotificationPayload =
  | { kind: 'STATUS_CHANGED';
      ideaTitle: string;
      fromState: IdeaStatus;
      toState:   IdeaStatus;
      actorDisplayName: string;   // already redacted per anonymity
    }
  | { kind: 'COMMENT_ADDED';
      ideaTitle: string;
      snippet:   string;          // ≤ 280 chars
      actorDisplayName: string;
    }
  | { kind: 'RATING_ADDED';
      ideaTitle: string;
      perDimension: Array<{ label: string; score: 1|2|3|4|5 | null }>;
      actorDisplayName: string;
    }
  | { kind: 'REPLY_ON_REVIEW';
      ideaTitle: string;
      snippet:   string;
      actorDisplayName: string;
    }
  | { kind: 'BULK_DIGEST';
      actorDisplayName: string;   // the admin who triggered the bulk
      items: Array<{
        ideaId:    string;
        ideaTitle: string;
        fromState: IdeaStatus;
        toState:   IdeaStatus;
      }>;
    };

type NotificationEvent = {
  id:          string;
  recipientId: string;
  ideaId:      string | null;      // null for BULK_DIGEST
  kind:        NotificationKind;
  payload:     NotificationPayload;
  createdAt:   string;             // ISO-8601 UTC
  readAt:      string | null;
};
```

**Anonymity invariant**: `payload.actorDisplayName` is computed at
enqueue time via the existing `maskAuthor()` projection (ADR-0018)
with the **recipient's role** as the audience parameter. The
dispatcher and the UI render the payload verbatim — they never
re-derive an actor name. This guarantees that even if a user's role
changes between event and read, the event reflects the policy at
event time.

**Deep link**: every notification carries an implicit deep link
`/ideas/<idea_id>` (or, for `BULK_DIGEST`, no deep link — the body
lists per-idea links).

---

## 6. Entity — `EmailDelivery`

```ts
type EmailDeliveryStatus = 'pending' | 'sent' | 'failed' | 'suppressed';

type EmailDelivery = {
  id:             string;
  eventId:        string;
  status:         EmailDeliveryStatus;
  attemptCount:   number;       // 0..5
  lastError:      string | null;
  lastAttemptAt:  string | null;
  nextAttemptAt:  string | null;
  createdAt:      string;
};
```

**Retry schedule** (`nextAttemptAt` is set on every failed attempt):

| Attempt | Delay from previous failure |
|---|---|
| 1 | n/a (first send) |
| 2 | 30 s |
| 3 | 2 m |
| 4 | 15 m |
| 5 | 1 h |
| 6 | 6 h |
| > 6 | terminal `failed` (no more retries) |

**`suppressed`** is the terminal status used when the recipient's
`email_preferences` for that event category is `0` at dispatch time
— it is recorded so audits can answer "why was no mail sent for
event X?".

---

## 7. Entity — `EmailPreference`

```ts
type EmailPreference = {
  userId:                   string;
  statusChanges:            boolean;
  commentsOnMyIdeas:        boolean;
  ratingsOnMyIdeas:         boolean;
  repliesOnIdeasIReview:    boolean;
  updatedAt:                string;
};
```

A missing row is treated as `{ ..., true, true, true, true }`.
On save, the row is INSERTed-or-UPDATEd (`ON CONFLICT(user_id)
DO UPDATE`).

---

## 8. Service contract summaries

| Module | Public function | Behaviour |
|---|---|---|
| `attachment-service` | `attachToIdea(ideaId, files, actor)` | Inserts up to N rows, enforces 10-count / 100 MB-total cap, returns the new ordered list. |
| `attachment-service` | `reorderAttachments(ideaId, orderedIds, actor)` | Asserts the id set equals the current set; writes `display_order` in one transaction. |
| `attachment-service` | `removeAttachment(attachmentId, actor)` | Asserts ownership and idea editability; deletes the row and schedules the file for storage GC. |
| `version-service` | `snapshotInitial(idea, actor)` | Writes `v1` in the create transaction. |
| `version-service` | `snapshotEdit(idea, prevAttachments, actor)` | Writes `v(N+1)` in the edit transaction. |
| `version-service` | `listVersions(ideaId, viewer)` | Returns `IdeaVersionSummary[]`. Same auth as idea detail. |
| `version-service` | `getVersion(ideaId, versionNo, viewer)` | Returns one `IdeaVersion`. |
| `diff-service` | `diffIdeaVersions(a, b)` | Pure; returns `IdeaDiff`. |
| `notification-service` | `enqueue(events)` | Writes `notification_events` + one `email_deliveries` per event whose recipient preference allows mail. Applies anonymity at enqueue time. |
| `notification-service` | `listForUser(userId, since)` | Returns unread count + recent 10 (used by the 60 s poll). |
| `notification-service` | `markRead(eventId, userId)` | Sets `read_at`. Idempotent. |
| `email-dispatcher` | `dispatchPending(now, deps)` | Pure; picks eligible rows from `email_deliveries`, calls `EmailTransport.send`, updates row. Returns `{ sent, retried, failed }` counts. |
| `email-preference-service` | `get(userId)` / `update(userId, prefs)` | Reads/writes `email_preferences`; validates with Zod. |

---

## 9. Error-code surface

See the table under "Constitution Check" in
[plan.md](./plan.md#error-code-surface-added-to-srcliberrorscodests).
Each new code is covered by at least one integration test
(Constitution VII.3 / Gate #9).

---

## 10. Performance budget — verification points

| Goal | Verification |
|---|---|
| Preview start ≤ 1.5 s for ≤ 5 MB files (NFR-001) | Integration test asserts the stream `headers` arrive in < 100 ms and the first chunk in < 500 ms on the baseline harness (a 5 MB PDF). |
| ≥ 95 % mail dispatched ≤ 30 s (NFR-002 / SC-002) | `email-dispatcher.test.ts` exercises the worker against the fake transport with a synthetic 100-event batch; histogram is asserted via an injected clock. |
| Badge poll cost — O(1) indexed count | `notifications-badge-poll.test.ts` asserts the SQL plan uses `idx_notifications_recipient_unread`. |
| Diff perf on a 200 KB prose field | `diff-service.test.ts` asserts < 100 ms wall on the baseline and that the `truncated` flag is set when paragraph fallback engages. |

---

**Output**: data-model complete. Move to contracts.
