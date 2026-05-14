# ADR-0018: Anonymity = category default + Admin per-idea override, snapshotted on submit

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-4 design
- **Consulted**: spec clarification 1, role model
- **Informed**: spec FR-021..FR-024, NFR-003, NFR-008, SC-005

## Context and Problem Statement

Story 3 requires anonymous evaluation, but the spec leaves three
points open: (a) **who** can toggle anonymity, (b) **when** the
decision is made, and (c) **what happens** when the category default
changes after submission.

## Decision Drivers

- FR-022: anonymity must be one-way (reviewer cannot see submitter)
  and must hold uniformly across queue, detail, thread, history.
- FR-023: changing the category default MUST NOT retroactively change
  anonymity on existing ideas.
- FR-024 / NFR-008: Admins must always see the real submitter; audit
  log retains real identity.
- SC-005: zero EVALUATOR-facing API responses contain submitter
  identifying fields for anonymous ideas, verified by automated
  tests.

## Considered Options

1. **Per-category default + Admin per-idea override, snapshotted on
   the idea row at submission time** (Decision).
2. Per-category default + Submitter per-idea override at submission.
3. Compute anonymity from the category at every read.
4. Two `users` rows per submitter (real + pseudonymous identity).

## Decision Outcome

Chosen option: **#1**. The schema carries
`categories.anonymous_default` and `ideas.anonymous`. At submission
time the service writes
`ideas.anonymous = override ?? category.anonymous_default`. The
`override` parameter is accepted only when the requester's role is
ADMIN. Subsequent changes to the category default never re-write
existing ideas; Admins may flip `ideas.anonymous` at any time and the
new value is reflected from then on.

A single pure helper `maskAuthor(idea, viewer)` runs in every
EVALUATOR-facing read path:

```text
hide = idea.anonymous AND viewer.role = 'EVALUATOR' AND viewer.userId != idea.authorId
```

The audit log is never masked — every audit row records the real
`actorId`. Anonymity is a viewer projection only.

### Positive Consequences

- One boolean per row, one helper, one mental model.
- FR-023 falls out by construction: the idea's own flag is the truth.
- SC-005 is testable: enumerate every EVALUATOR-facing endpoint,
  submit one anonymous idea, assert no identifying field appears in
  any response.
- Admin moderation (FR-024) and audit (NFR-008) keep the real
  identity unchanged.

### Negative Consequences

- Submitters cannot request anonymity themselves in v1. Acceptable
  per the spec's "Submitters can request" being explicitly listed as
  a clarification needing resolution; this ADR resolves it on the
  stricter side.
- Two boolean columns instead of one (`categories.anonymous_default`
  and `ideas.anonymous`). Trivial.

## Pros and Cons of the Options

- **Option 2** introduces a three-way conflict (category default vs.
  submitter request vs. admin override) without solving a real
  problem; spec FR-021 lists the submitter case as parenthetical
  ("per project configuration").
- **Option 3** violates FR-023 — re-toggling the category default
  would retroactively rewrite anonymity for existing ideas, surprising
  users.
- **Option 4** is heavy cryptography for a server-side authorisation
  rule.

## Links

- Implements [FR-021..FR-024](../spec.md).
- Cooperates with [ADR-0017](./0017-drafts-separate-table.md) — the
  effective anonymity is computed at draft-submit time, not at
  draft-save time.
- The pure helper `maskAuthor` is documented in
  [data-model.md §5](../data-model.md).
