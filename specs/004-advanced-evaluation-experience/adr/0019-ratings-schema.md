# ADR-0019: Multi-dimensional ratings — category-scoped dimensions with per-evaluator scores and lock-on-decide

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-4 design
- **Consulted**: spec clarification 2, existing decision flow
- **Informed**: spec FR-009..FR-015

## Context and Problem Statement

Story 2 introduces 1–5 ratings on each evaluation, broken out into
category-configurable rating dimensions. We must decide:

- The shape of the dimension catalogue (per-category? versioned?).
- The grain of a rating (per evaluator? aggregated?).
- When a rating becomes immutable.
- How the required-dimension gate interacts with the multi-evaluator
  pickup model carried over from Phase 3.

## Decision Drivers

- FR-009..FR-015 collectively demand: per-category configuration, a
  sensible default set, per-evaluator scores, lock at decision, a
  required-dimension gate, and read-only access to averages for
  Insights and history.
- Phase 3 assignment model: any EVALUATOR may pick up any idea; no
  per-idea reviewer assignment. (Clarification 2.)
- Edge case in the spec: when a dimension is removed mid-flight,
  past scores must remain rendered with the old label and a
  "(deprecated)" suffix.

## Considered Options

1. **`rating_dimensions` table (category-scoped, with `category_id =
   NULL` rows as the default set) + `ratings` table keyed by `(idea,
   evaluator, dimension)`; lock the *deciding* evaluator's rows on
   decision** (Decision).
2. One row per `(idea, dimension)` — global, not per-evaluator;
   aggregate over evaluators implicitly.
3. Versioned dimensions: insert a new dimension row on every rename
   so history is exact.
4. Encode dimensions inside `categories.field_schema` (the Phase-2
   smart-form JSON).

## Decision Outcome

Chosen option: **#1**. Dimensions live in their own table; a category
"overrides" the default set by holding any non-null rows (wholesale,
not mixed). Each `(idea, evaluator, dimension)` may have at most one
`ratings` row (UNIQUE constraint). The `ratings.score` is nullable
(1..5 or "unrated"). On `UNDER_REVIEW → APPROVED|REJECTED`, the
service stamps `locked_at = now()` on every `ratings` row for the
deciding `(idea, evaluator)` pair within the same transaction.

The required-dimension gate (`canDecide(idea, evaluator)`) examines
*only the deciding evaluator's* scores. Other evaluators' ratings on
the same idea are independent and remain editable until they too
decide.

Dimension reconfiguration is non-destructive: removing a dimension
sets `active = 0` but keeps the row, so historical FK references
remain renderable.

### Positive Consequences

- One row per (evaluator, dimension) → trivial to attribute scores to
  reviewers on the detail page (FR-014) and average them for Insights
  (FR-015).
- Lock-on-decide is a single SQL `UPDATE` inside the existing
  decision transaction — atomic by construction.
- The required-dimension check is a pure function of the deciding
  evaluator's own scores; multi-evaluator pickups never produce a
  "blocked by someone else's scores" footgun.
- The default-set fallback removes config burden — categories that do
  nothing get sensible dimensions for free.

### Negative Consequences

- Visibility of *other* evaluators' live (unlocked) scores is opt-in
  for v1 (see Clarification 2): we show only locked scores from other
  evaluators on the detail page, to prevent anchoring. Acceptable
  trade-off; revisit if multi-evaluator collaboration becomes a
  first-class workflow.

## Pros and Cons of the Options

- **Option 2** conflicts with FR-014 ("each reviewer's per-dimension
  scores attributed to that reviewer"); requires a separate join
  table to recover the per-evaluator attribution we just collapsed.
- **Option 3** is the right answer for a serious analytics product
  but is overkill at our scale; rename history is not a v1
  requirement.
- **Option 4** conflates the category fields schema with the rating
  dimensions schema and loses the per-rating foreign key, breaking
  Insights aggregation.

## Links

- Implements [FR-009..FR-015](../spec.md).
- Cooperates with [ADR-0018](./0018-anonymity-model.md) — locked
  ratings of anonymous ideas are still attributed to the evaluator
  (not masked); the *submitter* is masked, the evaluator is not.
- Migration: [data-model.md §1, §3](../data-model.md).
