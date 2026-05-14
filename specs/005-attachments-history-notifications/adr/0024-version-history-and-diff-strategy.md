# ADR-0024: Idea versions are whole snapshots; diffs come from the `diff` npm package, computed server-side

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-5 design
- **Consulted**: Phase-3 `status_transitions` audit grammar, existing
  Phase-4 anonymity projection
- **Informed**: spec FR-020..FR-025, NFR-004

## Context and Problem Statement

Phase 5 introduces a versioned history of every author edit, with a
diff viewer that highlights changes per field. We must decide
**how versions are stored** and **how diffs are computed**.

## Decision Drivers

- The diff must be deterministic, server-side reproducible, and the
  integration tests must be able to assert on it (no client-side
  diff branch).
- The history list must be coherent for ideas that pre-date Phase 5
  (back-fill from Phase-3 `EDITED` audit rows).
- The storage cost scales with author-edit volume, which is bounded
  by author behaviour (≪ reader traffic).
- Constitution VII.3 — error envelopes and stable codes; the diff
  shape must be typed.

## Considered Options

1. **Whole-snapshot rows in `idea_versions` + `diff ^5.2` server-side
   to produce a typed per-field diff** (Decision).
2. Per-field history rows (EAV: `(version, field_name, value)`).
3. Delta-only storage — each row stores changes only; render = play
   forward from `v1`.
4. Diff in the client (server returns two snapshots).

## Decision Outcome

Chosen option: **#1**.

- `idea_versions` stores the post-edit values whole: `title`,
  `description`, `category_id`, `category_answers` (JSON),
  `attachment_ids` (JSON). One row per edit, numbered `1..N` per
  idea. `v1` is written in the same transaction as the originating
  `ideas` INSERT.
- The diff endpoint (`GET /api/ideas/[id]/versions/diff?from=&to=`)
  hydrates two rows and calls a pure function
  `diffIdeaVersions(a, b)` (in `src/server/diff-service.ts`) which
  returns a typed `IdeaDiff` whose `fields` array carries either
  prose hunks (from `diffWordsWithSpace`), opaque before/after for
  structured answers, or an attachment add/remove set (from
  `diffArrays` over the ordered id list).
- The UI renders the typed shape; it never re-computes a diff.
- For prose fields whose size exceeds 200 KB on either side, the
  diff falls back to a paragraph-level granularity and the response
  carries `truncated: true` so the UI can offer the "view full text"
  affordance per spec Edge Case.
- Tokens `--diff-add` / `--diff-remove` / `--diff-add-bg` /
  `--diff-remove-bg` are introduced in `src/styles/tokens.css` for
  both light and dark themes so the rendered diff re-themes with the
  app (FR-031 / SC-006).

### Positive Consequences

- Renders are O(1) per version (no replay).
- Diffs are unit-testable as a pure function over two literals.
- Adding a new editable field on the idea is "snapshot it in v(N+1)
  and add a case in the diff visitor" — no migration to the older
  rows.
- Storage is bounded by the number of author edits, not by reads.
- The history list survives back-fill: `v1` is reconstructable from
  the current row + the initial-create transition row; the
  intermediate `v(N>1)` are reconstructed (best-effort) from the
  Phase-3 `EDITED` audit rows.

### Negative Consequences

- Each snapshot duplicates the unchanged columns. At the spec scale
  (≤ 10 000 ideas, modest edit volume) this is fine; if it ever
  matters, the columns are highly compressible.
- The 200 KB-prose fallback adds one code path. Covered by a unit
  test with `it.each` boundary cases.

## Pros and Cons of the Options

- **Option 2** is fast for "what changed on field X over time" but
  pessimal for "render version N entirely" and for "diff two
  versions"; the join cost grows with version count.
- **Option 3** is fragile — a missing or corrupt delta poisons every
  subsequent render. The savings in storage are not worth the
  complexity at this scale.
- **Option 4** complicates testing (two oracles — server snapshot,
  client renderer), inflates payloads for diff-only viewers, and
  duplicates the diff dependency.

## Links

- Implements [FR-020..FR-025](../spec.md).
- Library: [`diff ^5.2`](https://www.npmjs.com/package/diff).
- Reuses the anonymity projection from
  [ADR-0018](../../004-advanced-evaluation-experience/adr/0018-anonymity-model.md):
  `actorId` on each snapshot is rendered via `maskAuthor` for
  EVALUATOR viewers of an anonymous idea.
