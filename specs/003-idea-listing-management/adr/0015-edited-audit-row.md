# ADR-0015: Encode `EDITED` audit events inside `status_transitions`

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-3 design
- **Consulted**: existing schema (`src/db/schema.ts`), Phase-1 migration `0000_init.sql`
- **Informed**: Phase-2 audit conventions

## Context and Problem Statement

The History tab (Story 4) needs to surface every meaningful event
about an idea — its creation, every state transition, and every
author-edit during the `SUBMITTED` window — in chronological order.
The `status_transitions` table already records state changes with
actor, comment, and timestamp. We must decide **where** to record
edit-marker events without introducing redundant audit
infrastructure.

## Decision Drivers

- The audit table already has the right columns (`actor_id`,
  `recorded_at`, `comment`), index, and cascade behaviour.
- A single chronological feed is much easier to query and render than
  a union over two tables.
- The state-machine grammar must not be changed: edits are not
  transitions.

## Considered Options

1. **Reuse `status_transitions` with `from_state = to_state`**
   (Decision). The widened CHECK constraint allows any of the five
   lifecycle states on both sides, and the application code is the
   only writer that produces `from = to` (only inside `editIdea`).
2. New table `idea_history` with a `kind` discriminator.
3. New boolean column `is_edit_marker` on `status_transitions`.
4. Derive edits from `ideas.updated_at` deltas.

## Decision Outcome

Chosen option: **#1**. Migration `drizzle/0002_listing_and_edits.sql`
rewrites the CHECK constraint. The `editIdea` service writes a row
with `from = to = SUBMITTED` (the only status in which edits can
happen, per ADR-0013), `actor = session.userId`, and an optional
edit comment.

The History tab reads `status_transitions` once and classifies each
row by whether `from = to`:

- `from = to` → kind `EDITED`
- `from ≠ to` → kind `TRANSITION`

The synthesised `SUBMITTED` event is prepended from `ideas.created_at`.

### Positive Consequences

- Zero new tables, zero new indexes for audit purposes.
- Cascade-on-delete continues to clean up audit rows when an idea is
  hard-deleted (ADR-0013).
- Single ORDER BY-and-classify pass renders the entire history.
- The state-machine grammar (the set of allowed *transitions*) is
  unchanged; the widened CHECK only adds non-transitions.

### Negative Consequences

- Anything joining `status_transitions` and wanting "real transitions
  only" must add `WHERE from_state != to_state`. We document this in
  the repo helper and add a unit test that fails if a future
  contributor forgets.
- The CHECK can no longer prove "every row is a state transition";
  that invariant moves to code (the `editIdea` and `transitionIdea`
  call sites). Acceptable because both writers are in
  `src/server/`.

## Pros and Cons of the Options

- **Option 2** (`idea_history` table) doubles the audit surface for
  one event kind; harder to keep two tables consistent forever.
- **Option 3** (boolean column) duplicates information that
  `from_state = to_state` already expresses.
- **Option 4** (derive from `updated_at`) collapses to one timestamp
  per row; loses actor + multi-edit granularity; not auditable.

## Links

- Implements [FR-017..FR-019](../spec.md).
- Built on top of [ADR-0013](./0013-edit-delete-cutoff.md).
- Migration: `drizzle/0002_listing_and_edits.sql` (see
  [data-model.md §7](../data-model.md)).
