# ADR-0020: Comment thread is one table, one-level nesting, soft delete, decision-tagged

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-4 design
- **Consulted**: spec Story 2, NFR-007, moderation requirements
- **Informed**: spec FR-016..FR-020, NFR-007

## Context and Problem Statement

Story 2 introduces a discussion thread on each idea. We must decide:
the storage shape, the nesting model, the edit/delete policy, where
the decision comment lives, and how to keep the surface XSS-immune.

## Decision Drivers

- FR-017: top-level comments + one level of replies; deeper nesting
  out of scope.
- FR-019: the decision comment lives in the thread, not in a
  separate table.
- FR-020: 5-minute edit/delete grace for the author; Admin soft
  delete with attribution.
- NFR-007: plain text only; no HTML/JS injection surface.

## Considered Options

1. **Single `comments` table with one-level nesting (enforced in
   service), `kind in {'COMMENT','DECISION'}`, soft delete with
   moderator attribution; plain text body rendered with escape +
   line-break conversion** (Decision).
2. Unlimited nesting via `parent_id` chain.
3. Separate `decision_comments` table from regular comments.
4. Markdown body (sanitised via DOMPurify).

## Decision Outcome

Chosen option: **#1**. One table holds every comment on every idea.
`parent_id` is nullable; when present it must reference a top-level
comment (whose own `parent_id` is null). The invariant is enforced
in the service: a POST with a parent that is itself a reply rejects
with `COMMENT_NESTING_EXCEEDED` (HTTP 422). Two `kind` values exist:
`COMMENT` (user-authored) and `DECISION` (system-emitted when an
evaluator finalises Approve/Reject — body = decision comment text,
parent = null, author = the deciding evaluator).

Edit/delete by the author is permitted for 5 minutes after
`created_at`; after that → `COMMENT_EDIT_WINDOW_EXPIRED`. Admins
may soft-delete any comment (`deleted_at`, `deleted_by_id`); the read
projection replaces the body with `"[comment removed by moderator]"`.

Body is plain text. Rendering goes through
`escapeAndLinebreak(text)` which HTML-escapes everything and converts
`\n` → `<br>`. No sanitiser library; nothing to sanitise.

### Positive Consequences

- One schema for every kind of message → history tab folds the
  decision comment in natural chronological order (FR-019).
- Soft delete preserves thread coherence: orphan replies still have
  a visible parent slot.
- Plain-text-only is XSS-immune by construction — the rendering
  function never produces an HTML tag from user input.

### Negative Consequences

- No rich text in v1. Acceptable per spec Assumptions.
- No mentions / reactions / attachments on comments. Out of scope.

## Pros and Cons of the Options

- **Option 2** invites unbounded reply trees and a UI design problem
  not in scope.
- **Option 3** duplicates the schema; FR-019 explicitly says the
  decision lives in the thread.
- **Option 4** introduces a sanitiser dependency and a much larger
  XSS attack surface for no requirement.

## Links

- Implements [FR-016..FR-020](../spec.md), NFR-007.
- Cooperates with [ADR-0018](./0018-anonymity-model.md) — comments
  authored by the submitter are run through `maskAuthor` on every
  EVALUATOR-facing read.
- Cooperates with [ADR-0019](./0019-ratings-schema.md) — the
  decision-comment row is inserted by `ideaService.decide()` in the
  same transaction that locks the deciding evaluator's ratings.
