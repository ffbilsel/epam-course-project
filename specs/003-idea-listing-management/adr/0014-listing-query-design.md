# ADR-0014: Listing query is server-side, URL-bound, AND-semantic

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-3 design
- **Consulted**: existing `idea-repo.ts`, NextAuth role guards
- **Informed**: spec FR-007..FR-016

## Context and Problem Statement

Phase 3 adds search, multi-filter, and pagination across three
distinct listing surfaces (employee My Ideas, reviewer queue, admin
all-ideas) and reuses the same filter for CSV export. We must decide
**where** filtering happens, **how** filter state is represented, and
**which boolean semantics** combine the filters.

## Decision Drivers

- Role-scoped data — leaking rows across roles is a security bug.
- Deep-linkability (FR-011) and predictable back/forward navigation.
- Two of three listing surfaces are RSC pages; one is a route
  handler. They must share a single query path.
- Constitution VII.3 (consistent error envelope) and VII (consistent
  URL / API shape).

## Considered Options

1. **Server-side, URL-bound, AND** (Decision).
2. Client-side filtering over a fetch-all endpoint.
3. Server-side filtering, body-bound (POST with JSON filter), no URL state.
4. GraphQL endpoint with a structured query node.

## Decision Outcome

Chosen option: **#1**. A single Zod `ListingQuery` schema is parsed
from `URLSearchParams` and reused by every page, the API handler, and
the CSV export. Filters AND together. Per-role scope is enforced
inside `idea-listing.ts` based on the session, never the client.

### Positive Consequences

- One predicate path → CSV export is exactly "what you see, in a
  file" with zero risk of drift.
- Filtered views are bookmarkable and shareable.
- Per-role scope is a server invariant; a hostile client cannot fetch
  out-of-scope ideas.
- Pagination plays well with the index `idx_ideas_search` introduced
  in `drizzle/0002_listing_and_edits.sql`.

### Negative Consequences

- Free-text search uses SQLite `LIKE`. At ≤ 10 000 rows it meets the
  SC-003 budget; beyond ~100 000 rows we would need FTS5.
- Every filter change is a server round-trip. Acceptable because
  pages are RSC and renders are cheap.

## Pros and Cons of the Options

- **Option 2** leaks data across roles (the fetch-all response would
  contain ideas a user must not see) and scales poorly at SC-004.
- **Option 3** breaks back/forward, deep-linking, and bookmarking.
- **Option 4** introduces a query language we do not need, and a new
  error-envelope contract.

## Links

- Implements [FR-007..FR-016](../spec.md).
- Cooperates with [ADR-0016](./0016-csv-export-streaming.md), which
  consumes this query path without `LIMIT/OFFSET`.
