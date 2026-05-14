# Architecture Decision Records — Phase 4

This folder records the load-bearing design decisions for feature
`004-advanced-evaluation-experience`. Each ADR follows the MADR
template adopted by the constitution (Principle IX).

| ID | Title | Status |
|---|---|---|
| [0017](./0017-drafts-separate-table.md) | Drafts live in their own `idea_drafts` table, not as an idea lifecycle state | Accepted |
| [0018](./0018-anonymity-model.md) | Anonymity = category default + Admin per-idea override, snapshotted on submit | Accepted |
| [0019](./0019-ratings-schema.md) | Multi-dimensional ratings: category-scoped dimensions + per-evaluator scores with lock-on-decide | Accepted |
| [0020](./0020-comment-thread-shape.md) | One `comments` table, one-level nesting, soft delete, decision tag | Accepted |
| [0021](./0021-recharts-as-chart-engine.md) | Insights charts use Recharts | Accepted |
| [0022](./0022-makeover-design-tokens.md) | Frontend makeover uses Tailwind + CSS-variable design tokens with class-based dark mode | Accepted |
