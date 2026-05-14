# ADR-0017: Drafts live in their own `idea_drafts` table

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-4 design
- **Consulted**: existing `ideas` table, `status_transitions` audit grammar
- **Informed**: spec FR-001..FR-008, NFR-004

## Context and Problem Statement

Phase 4 introduces saved drafts (Story 1). A draft is a private
work-in-progress that must never appear in any reviewer, admin, or
aggregate surface. We must decide **where the draft lives**: as a new
lifecycle state on `ideas`, or as a separate table.

## Decision Drivers

- FR-003 / NFR-004: drafts MUST be invisible to every aggregate query
  (listing, insights, exports). Any solution that depends on every
  consumer remembering to filter is a footgun.
- FR-006: submitting a draft transitions it into the `SUBMITTED`
  lifecycle state and runs the same validation as a brand-new
  submission.
- Phase-3 `status_transitions` already encodes audit kinds via
  `from = to`; introducing `DRAFT` as a state would re-open that
  grammar.

## Considered Options

1. **Separate `idea_drafts` table; submit creates a fresh `ideas`
   row** (Decision).
2. `DRAFT` as a sixth `IdeaStatus` value.
3. Local-storage-only drafts (no server persistence).
4. Promote-in-place: draft row becomes the idea row on submit.

## Decision Outcome

Chosen option: **#1**. A new physical table holds drafts. The
read paths for the table are scoped to the author (route handlers
filter on `session.userId`); no other surface even knows the table
exists. Submitting deletes the draft and inserts a fresh `ideas`
row in `SUBMITTED` within a single transaction.

### Positive Consequences

- Drafts are physically inaccessible to non-authors — privacy is a
  property of the schema, not a discipline.
- Listing/insight/export queries are unchanged; no risk of leaking
  a draft via a forgotten filter.
- The state-machine grammar is unchanged — no `DRAFT → SUBMITTED`
  transition to encode; the new idea row is simply born in
  `SUBMITTED` and audited that way.

### Negative Consequences

- Two tables to keep in sync at the *type* layer (a `Draft` is not
  an `Idea`). Handled with a discriminated union and two repos.
- A draft-only attachment must be re-pointed at the new idea id on
  submit. Handled inside the submit transaction.

## Pros and Cons of the Options

- **Option 2** pollutes every listing/insight query with a `status !=
  'DRAFT'` filter; one forgotten filter is a privacy bug.
- **Option 3** loses cross-device drafts (the spec explicitly cites
  "logs back in later") and is unrecoverable on cache eviction.
- **Option 4** is acceptable per the spec's Assumptions but leaves the
  new idea carrying draft-era timestamps that confuse the audit log
  and the "newest first" ordering.

## Links

- Implements [FR-001..FR-008](../spec.md).
- Cooperates with [ADR-0018](./0018-anonymity-model.md) — the
  `effectiveAnonymity` computation runs at draft-submit time, not at
  draft-save time.
