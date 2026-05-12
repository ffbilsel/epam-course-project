# ADR-0010: Store structured answers inline on `ideas` with a per-answer label snapshot

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-002](../research.md#r-002--how-are-submitted-answers-persisted-and-how-do-we-keep-historical-answers-readable-after-a-schema-edit), [data-model.md "Entity: IdeaStructuredAnswer"](../data-model.md#entity-value-object-ideastructuredanswer), spec FR-008 / FR-010

## Context

FR-008 mandates that historical answers remain readable even after
the underlying field is removed from the category schema (the
detail view must still show the label that was in effect at
submission time). FR-010 mandates that schema edits never mutate
stored answers.

These two requirements together imply that the **label is part of
each answer**, not a foreign-key reference to a schema row that
may later disappear.

## Decision

Persist answers as **JSON on the idea row**:

- Add `category_answers TEXT NOT NULL DEFAULT '[]'` to `ideas`.
- The column holds the JSON encoding of an
  `IdeaStructuredAnswer[]` where each element carries:
  - `key` — stable field key,
  - `labelSnapshot` — the field label that was rendered to the
    user at submission time,
  - `type` — discriminator copied for forward compatibility,
  - `value` — typed per the discriminator,
  - `valueLabelSnapshot` (*`SINGLE_CHOICE` only*) — the chosen
    option's `label` at submission time. This is the **only**
    string the detail page renders for a `SINGLE_CHOICE` answer;
    `value` is retained for audits / exports but never displayed.
    Without this second snapshot, renaming or removing an option
    on the live schema would silently corrupt historical answers,
    re-introducing the very failure mode FR-008 was written to
    prevent at the field level.
- Optional fields with no answer are **omitted** from the array
  (not stored as `null`).
- Schema is **never** consulted to display labels on the detail
  page; the snapshot is the source of truth. The live schema is
  read only to determine display **order** for fields that still
  exist; unknown / orphaned snapshots are appended at the end in
  their original array order.

## Consequences

**Positive**

- FR-008 is satisfied by construction; removing a field from the
  schema leaves historical answers fully readable.
- FR-010 is satisfied by construction; schema edits touch
  `categories.field_schema` only, never `ideas.category_answers`.
- One SELECT to render the detail page (same as Phase 1, plus the
  larger payload).
- The label snapshot makes the JSON self-describing for audits
  and exports.

**Negative**

- Disk overhead: each answer carries its own label string,
  duplicating data across many ideas in the same category. At our
  scale (≤ 10 000 ideas × ≤ 8 fields × ~50 bytes) the overhead is
  bounded at a few MB and is negligible relative to attachments.
- Renaming a field on the live schema is **not** reflected in
  historical ideas — by design. If a future phase wants
  "rename-and-rewrite-history" semantics, it will need a separate
  migration step (and probably an ADR superseding this one).

## Alternatives considered

1. **`idea_field_answers` child table with `label_snapshot`
   column.** Same data, more rows. Rejected: forces a JOIN on the
   detail page and adds cascade-delete logic without changing the
   storage model — labels would still need to be snapshotted.
2. **Resolve labels from the live schema at read time.**
   Rejected: directly violates FR-008 the moment a field is
   removed; would require a "trash" of removed fields, which is
   strictly more storage than the per-answer snapshot.
3. **Versioned schemas (`schema_version_id` per idea).**
   Rejected: multiplies schema rows by N versions per category
   and forces every idea read to JOIN against a versioned
   `category_schemas` table. The label-snapshot approach hits the
   same historical-fidelity target with O(1) reads.
