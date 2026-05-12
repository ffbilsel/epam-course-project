# ADR-0008: Attachment row is created with `idea_id = NULL` to support stage-then-commit

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [ADR-0005](./0005-attachment-storage.md), [data-model.md "Entity: Attachment"](../data-model.md), [spec.md FR-009…FR-011](../spec.md)

## Context

[ADR-0005](./0005-attachment-storage.md) defined a stage-then-commit
upload flow: `POST /api/attachments` writes a file to `.staging/`
and inserts a DB row before the parent Idea exists; the row is
later linked to an Idea by `POST /api/ideas`. The original
[data-model.md](../data-model.md) entry for `attachments`, however,
described `idea_id` as `NOT NULL` with `ON DELETE CASCADE`. Those
two contracts cannot both hold: if `idea_id` is `NOT NULL` at the
column level, the staging insert is impossible without first
inserting a placeholder row in `ideas`, which would then need its
own cleanup story and would briefly violate the Idea status enum.

We considered three resolutions:

1. **Insert a placeholder Idea during staging** and delete it on
   commit failure. Rejected: doubles the moving parts, leaks
   half-formed ideas if the sweeper misses a row, and pollutes any
   future "ideas authored by user" query.
2. **Hold the file in memory** until the Idea POST and write only
   on commit. Rejected: defeats the type-sniff-then-respond UX
   (we want to reject a renamed `.exe` *before* the user fills
   the form), and the upload size cap is 25 MB which we do not
   want to keep buffered in process memory across requests.
3. **Allow `attachments.idea_id` to be `NULL` while in `.staging/`,
   enforce non-null at the service boundary on commit, and rely on
   the sweeper to GC orphaned rows.** This is the path code took.

## Decision

`attachments.idea_id` is **nullable at the column level** in the
SQLite schema and migrations. Application code maintains the
following invariants:

1. The `attachment-service.stageUpload` insert path is the **only**
   place that may persist a row with `idea_id IS NULL`.
2. `idea-service.createIdea` performs the commit step inside a
   single SQLite transaction:
   - rename the file from `./data/uploads/.staging/...` to
     `./data/uploads/<ideaId>/...`;
   - update `attachments.idea_id = <ideaId>` and `stored_path`.
3. Any `GET` / read path that returns an attachment (idea detail,
   download stream) **must** filter `idea_id IS NOT NULL`. A row
   with `idea_id IS NULL` is internally ungettable by definition.
4. The startup sweeper in `src/instrumentation.ts` deletes both
   the file in `.staging/` *and* the matching `attachments` row
   when the staging timestamp is older than 1 hour, so orphans
   cannot accumulate.
5. The `UNIQUE(idea_id)` index relies on SQLite's behaviour of
   treating multiple `NULL` values as distinct, so the constraint
   continues to enforce "at most one attachment per Idea" without
   blocking concurrent staging by different users.

`ON DELETE CASCADE` from `ideas → attachments` remains in effect
for committed rows, so deleting an Idea (a future feature) still
removes its attachment without an application-layer join.

## Consequences

**Positive**

- The stage-then-commit flow from ADR-0005 is implementable as
  designed without placeholder Idea rows.
- Magic-number sniffing happens before the user finishes the form,
  preserving the intended UX.
- Crash semantics are simple: a row with `idea_id IS NULL` plus a
  file in `.staging/` is *the* "abandoned upload" state, and is GC'd
  by exactly one mechanism (the sweeper).

**Negative**

- The schema no longer self-documents the "every attachment belongs
  to an Idea" invariant; that invariant lives in this ADR and in
  `attachment-service` instead. New read sites must remember to
  filter `idea_id IS NOT NULL`.
- Backups taken mid-stage may include rows that the sweeper would
  have removed; restoring such a backup leaves orphans until the
  next sweeper pass, which is acceptable.
- A future migration to a non-SQLite engine must verify that the
  target's `UNIQUE` semantics treat multiple `NULL`s as distinct
  (PostgreSQL does; MySQL InnoDB does; SQL Server does not).

## Alternatives considered

See "Context" above. The placeholder-Idea and in-memory-buffer
alternatives were rejected for the reasons listed there.

## Updates to other artefacts

- [data-model.md](../data-model.md) "Entity: Attachment" should be
  read as: `idea_id` is `NULL` while staged and `NOT NULL` once
  committed; the `ON DELETE CASCADE` clause applies once committed.
  This ADR is the binding statement; the data-model description is
  illustrative.
