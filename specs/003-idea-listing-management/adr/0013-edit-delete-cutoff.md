# ADR-0013: Edit/Delete cutoff for ideas is `status = SUBMITTED`

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-3 design (solo course project; self-review)
- **Consulted**: existing state-machine in `src/server/idea-state-machine.ts`
- **Informed**: spec [001-innovatepam-portal-mvp/spec.md](../../001-innovatepam-portal-mvp/spec.md)

## Context and Problem Statement

Phase 3 introduces author-driven edit and hard delete for ideas. The
existing state machine has no concept of "mutable body": once an idea
exists, only its status changes. We must decide **for which statuses**
an author may PATCH or DELETE their own idea so the rule is
predictable, defensible against silent edits beneath a reviewer's
nose, and cheap to implement.

## Decision Drivers

- Reviewers must always evaluate the artefact they started reviewing.
- The product already conveys "the decision is locked" via
  `IDEA_ALREADY_DECIDED`; the edit rule should mirror that intuition
  one step earlier.
- "Don't show buttons that always fail" (Constitution VI.3).
- Minimise state-machine surface area; do not introduce new states.

## Considered Options

1. **Editable iff `status = SUBMITTED`** (Decision).
2. Editable up to `UNDER_REVIEW`, with a "re-review" hint flag.
3. Editable in any non-terminal status (`SUBMITTED`, `UNDER_REVIEW`).
4. Editable always, with full version history append-only.

## Decision Outcome

Chosen option: **#1 — editable and deletable only while
`status = SUBMITTED`.**

`canAuthorEdit` and `canAuthorDelete` are pure functions in
`idea-state-machine.ts`; the UI hides controls when they return
false, and the service rejects mutations with `IDEA_NOT_EDITABLE` /
`IDEA_NOT_DELETABLE` (HTTP 409).

### Positive Consequences

- One predicate (`status === 'SUBMITTED'`) drives both UI visibility
  and server enforcement. No drift possible.
- No new state, no new transition. Smallest diff against Phase 1/2.
- Reviewers cannot have artefacts mutated under them mid-review.

### Negative Consequences

- Once review starts, an author who notices a typo must ask a
  reviewer to reject the idea so they can re-submit. Acceptable
  because the spec scopes versioned edits to a later phase.
- Hard delete is irreversible (Assumption 8 of the spec); no
  "undelete" feature.

## Pros and Cons of the Options

- **Option 2** (editable up to `UNDER_REVIEW`, re-review prompt)
  needs a re-review channel and visible diffs to be honest; the
  spec does not call for either.
- **Option 3** (editable in any non-terminal status) lets an author
  rewrite a proposal while a reviewer is actively assessing it —
  exactly the failure mode we are trying to prevent.
- **Option 4** (full versioning) solves a different problem (idea
  versioning, listed separately in the TODO file). Not in scope for
  Phase 3.

## Links

- Implements [FR-001..FR-006](../spec.md).
- Influences [ADR-0015](./0015-edited-audit-row.md): the audit row is
  recorded with `from = to = SUBMITTED` because that is the only
  status in which edits can occur.
