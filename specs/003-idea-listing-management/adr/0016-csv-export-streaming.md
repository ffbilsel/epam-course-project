# ADR-0016: CSV export streams over the listing query

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-3 design
- **Consulted**: ADR-0014 (listing query), spec SC-006
- **Informed**: ops / hosting envelope (Node 20 on a modest course-project VM)

## Context and Problem Statement

Admins must be able to export the *current filter set* to CSV
(Story 5). The dataset can reach the spec's scale target of 10 000
ideas. We must decide **how** the export is assembled and shipped so
the SC-006 ≤ 10 s budget holds without spiking server memory.

## Decision Drivers

- Match "what you see is what you export" — no second predicate.
- Memory should not scale linearly with the export size.
- No new runtime dependency for a feature of this size (Constitution VII).
- The action must be auditable (FR-027).

## Considered Options

1. **Stream a `ReadableStream` over the listing query**, with rows
   pulled in batches of 500 and an in-house RFC 4180 writer
   (Decision).
2. Buffer the whole CSV in memory, then return it as a single
   `Response`.
3. Use `papaparse` / `csv-stringify` / similar to generate the CSV.
4. Export to XLSX (binary) via `exceljs`.

## Decision Outcome

Chosen option: **#1**. The handler at `src/app/api/ideas/export/route.ts`:

1. Validates the same `ListingQuery` schema as the listing endpoint
   (sans `page`/`pageSize`).
2. Creates a `ReadableStream<Uint8Array>` whose `pull()` calls a
   batched Drizzle iterator (batch size 500 rows, ordered by
   `created_at DESC` for stable output).
3. Each batch is run through `formatCsvRow` from
   `src/lib/format/csv.ts` and `controller.enqueue()`d as
   `TextEncoder.encode(line)`.
4. On close, a `security` event of kind `idea_export` is recorded
   with the filter snapshot and the row count.

### Positive Consequences

- Constant memory footprint: ~500 rows × ~1 KB ≈ 500 KB peak, not
  10 MB.
- Comfortable inside the SC-006 budget on a small VM.
- Zero new runtime deps. The CSV writer is < 30 LOC of pure
  TypeScript; unit-tested against the RFC 4180 corner cases.
- Reuses the listing query path — drift between "listing" and
  "export" is impossible by construction.

### Negative Consequences

- A future "export with attachments as a ZIP" feature would need a
  different response type and its own ADR.
- We must handle aborted requests (client closes the tab mid-stream)
  by aborting the iterator. Standard `AbortSignal` plumbing.

## Pros and Cons of the Options

- **Option 2** (buffer in memory): simplest code but loses on SC-006
  at 10 000 rows on a modest VM.
- **Option 3** (lib): the lib surface (parser + formatter + streams)
  is overkill for a one-direction formatter of this size.
- **Option 4** (XLSX): the spec asks for CSV; XLSX pulls in a much
  larger dep tree.

## Links

- Implements [FR-024..FR-027](../spec.md).
- Consumes [ADR-0014](./0014-listing-query-design.md) (same predicate
  path).
- CSV format helper at `src/lib/format/csv.ts`.
