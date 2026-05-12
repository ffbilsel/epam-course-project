# ADR-0005: Local filesystem attachments with stage-then-commit

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-006](../research.md), [data-model.md "Entity: Attachment"](../data-model.md), [spec.md FR-009…FR-011](../spec.md)

## Context

Each Idea may have at most one supporting attachment (PDF, PNG,
JPEG, DOCX, PPTX, ≤ 25 MB). The MVP runs on a single host; we have
no S3 budget. We must (a) verify the file is actually one of the
allowed types (not just a renamed `.exe`), (b) keep DB and disk
consistent (no orphan rows, no orphan files), and (c) impose a
sane rate limit on uploads to deter abuse.

## Decision

Store attachments on the **local filesystem** under
`./data/uploads/`, with a **stage-then-commit** workflow:

1. **Stage** — `POST /api/attachments` (multipart). The file is
   written to `./data/uploads/.staging/<attachmentId>__<sanitised>`,
   its first 4 KB are sniffed via the `file-type` package against
   the MIME allow-list, the size cap is enforced, and a row is
   inserted with `ideaId = NULL` (intermediate state). The response
   is the `attachmentId`.
2. **Commit** — when the user finally submits the idea
   (`POST /api/ideas`), the request includes that `attachmentId`.
   In a single SQLite transaction we set `attachment.ideaId = newId`
   and rename the file from `.staging/` to
   `./data/uploads/<ideaId>/<attachmentId>__<sanitised>`.
3. **Sweep** — on app startup a sweeper deletes anything still in
   `.staging/` older than 1 hour, so abandoned uploads cannot leak
   disk.

Rate limit: in-memory `@upstash/ratelimit` on `POST /api/attachments`
keyed by user id (and IP for unauthenticated `/api/auth/*`).
`storedPath` is persisted as a path **relative** to `./data/uploads/`
so the upload root can be relocated without a DB migration.

## Consequences

**Positive**
- Zero external services; works on a single VM or a developer
  laptop with one persistent disk.
- Magic-number sniffing (not header trust) blocks the most common
  upload-extension attack.
- The stage-then-commit flow keeps DB and FS consistent: a crash
  between steps leaves only an orphan in `.staging/`, which the
  sweeper handles.
- Per-idea folder layout makes it easy to spot-delete (e.g. on
  account removal in a future phase).

**Negative**
- A single host is a single point of failure for files; not suitable
  beyond the pilot scale.
- Backups must include `./data/uploads/`, not just the DB file.
- The sweeper must run; we wire it into the Next.js custom server
  startup hook.

## Alternatives considered

- **S3 / Azure Blob**: appropriate at scale, out of scope for the
  course.
- **Store files as BLOBs in SQLite**: bloats the DB file, complicates
  backups, and removes the ability to stream large files without
  loading them into memory.
- **Trust client-supplied `Content-Type`**: insecure (well-known
  upload-extension attack class).
