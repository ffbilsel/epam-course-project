# Phase 0 — Research: Idea Listing & Management Enhancements

**Feature**: `003-idea-listing-management`  
**Date**: 2026-05-14  
**Status**: Complete — every `NEEDS CLARIFICATION` from the plan is resolved here.

## Inputs

- [spec.md](./spec.md) — 5 user stories, 27 functional requirements, 6 success criteria.
- [plan.md](./plan.md) — technical context, structure, constitution check.
- Constitution v1.4.0 (`.specify/memory/constitution.md`).
- Existing codebase: idea-service.ts, idea-state-machine.ts, idea-repo.ts, status_transitions table from Phase 1; smart-forms answer storage from Phase 2.

## Open questions raised by the plan

The plan's Technical Context lists no `NEEDS CLARIFICATION` markers — every assumption is already pinned in the spec's Assumptions section. The research below justifies the four load-bearing design choices that warrant their own ADRs (0013–0016) and rejects the alternatives that were considered.

---

## Decision 1 — Edit & delete cutoff is `status = SUBMITTED`

### Decision

An idea is editable and deletable by its author **iff** its current status is `SUBMITTED`. Once a reviewer moves it to `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `IMPLEMENTED` the author can no longer edit or delete; the controls disappear from the UI and the API returns `IDEA_NOT_EDITABLE` (or `IDEA_NOT_DELETABLE`) with HTTP 409. Edits MAY change title, description, category, structured answers (Phase-2 schema), and the attached file. Delete is a **hard delete** that cascades to `idea_answers`, `attachments`, and `status_transitions`.

### Rationale

- Aligns with the existing state-machine philosophy: `IDEA_ALREADY_DECIDED` already locks `APPROVE` / `REJECT` once a decision has been made. Locking edits as soon as work *begins* on the artefact (i.e. `UNDER_REVIEW`) is the same principle one step earlier in the timeline.
- Reviewers must always evaluate the artefact they actually started reviewing. Allowing edits after `START_REVIEW` would let an author silently rewrite the proposal underneath the reviewer.
- Hard delete keeps `main` simple. The spec's compliance discussion (Assumption 8) explicitly says tamper-evident retention is out of scope for v1.

### Alternatives considered

| Alternative | Rejected because |
|---|---|
| **Editable up to `UNDER_REVIEW`, soft delete** (idea hidden but kept). | Soft-delete adds a column (`deleted_at`) and a filter to *every* listing query; the v1 value of being able to "undelete" is speculative. |
| **Editable in any non-terminal status**, with a re-review prompt to the reviewer. | Forces a UX contract on reviewers (re-read the diff) that the spec does not ask for and that has its own UI surface. Punts complexity to a later phase. |
| **Append-only edit history**, keeping every prior body version. | Useful but solves a *different* problem (Idea Versioning is on the TODO list as a separate item). Outside the scope of this spec. |

### Consequences

- ✅ Smallest viable change to the state machine grammar (no new states or transitions; the audit-row encoding lives in `status_transitions` per Decision 3).
- ✅ Predictable UI: Edit/Delete are visible *only* when they will succeed (Constitution VI.3 "no buttons that always fail").
- ✗ No "undelete" — if a user deletes a `SUBMITTED` idea, it is gone. Acceptable because reaching `SUBMITTED` is cheap (re-fill the form).
- ✗ Attachment files are removed from disk synchronously inside the delete transaction; if the disk write fails the transaction rolls back and the idea row is preserved (atomicity preserved at row level — file deletion is best-effort retried on the next cron sweep, out of scope here).

Recorded as [ADR-0013](./adr/0013-edit-delete-cutoff.md).

---

## Decision 2 — Server-side listing query, URL-bound, AND-semantics, per-role scope

### Decision

A single `ListingQuery` Zod schema drives every listing surface — My Ideas (employee scope), Review Queue (reviewer/admin scope), Admin all-ideas (admin scope), and the CSV export. The query is parsed once from `URLSearchParams` by `parseListingQuery()` and is reflected in the URL on every change (filters, search, page, page size). Filters combine with AND semantics. The query is **always evaluated server-side** so per-role scoping cannot be bypassed by a crafted client. Default ordering is `created_at DESC` everywhere.

Query parameters:

| Param | Type | Default | Notes |
|---|---|---|---|
| `q` | trimmed string, ≤ 200 chars | `""` | case-insensitive `LIKE '%q%'` on `title` + `description` |
| `categoryId` | uuid | _unset_ | single category |
| `status` | repeatable enum | _unset_ (all) | one or more of the five lifecycle statuses |
| `from` | ISO date (yyyy-mm-dd) | _unset_ | inclusive, applied to `created_at` |
| `to` | ISO date (yyyy-mm-dd) | _unset_ | inclusive end-of-day, applied to `created_at` |
| `page` | int ≥ 1 | `1` | clamped to last available page on overflow |
| `pageSize` | one of `20 \| 50 \| 100` | `20` | rejected if not one of the three |

### Rationale

- Server-side filtering is the only safe answer in a multi-role app: an employee must never receive someone else's ideas, even momentarily. Client-side filtering of a "give me everything" response would leak data.
- URL-bound state gives free back/forward navigation, bookmarkable filtered views, and trivial deep-links from email/Slack — all of which the spec asks for in FR-011.
- AND semantics is the user-intuitive default ("I want approved ideas in Tooling from last week"). OR semantics would require an explicit query language the spec does not call for.
- Limiting `pageSize` to three options keeps the cardinality of cached query plans tiny.

### Alternatives considered

| Alternative | Rejected because |
|---|---|
| Client-side filtering + a fetch-all endpoint. | Leaks data across roles; performs poorly at the SC-004 scale target; fights the App-Router RSC story. |
| Full-text-search engine (SQLite FTS5). | Overkill at the 10 000-row scale; adds a virtual table and a migration; the spec only needs `LIKE` semantics. Revisit when scale ≥ 100 000 ideas. |
| GraphQL or RPC instead of `GET /api/ideas` query params. | Inconsistent with the rest of the API surface (REST + error envelope per Constitution VII.3). |
| Persisted "saved views" (named filter sets). | Out of scope; user can already bookmark the URL. |

### Consequences

- ✅ One query path feeds every listing surface and the CSV export — no code duplication.
- ✅ Per-role scope is enforced once, in the service, never in the client.
- ✗ Free-text search is `LIKE`-based — no stemming, no ranking. Acceptable at the spec's scale.
- ✗ A new composite index is required to keep the listing plan covering for status + category + date.

Recorded as [ADR-0014](./adr/0014-listing-query-design.md).

---

## Decision 3 — `EDITED` audit events live in `status_transitions` with `from = to`

### Decision

Author edits are recorded as rows in the existing `status_transitions` table with `from_state = to_state = <current status of the idea at the time of the edit>`. The table's CHECK constraint is rewritten in `drizzle/0002_listing_and_edits.sql` to allow that case (and only that case). The actor is the author; the comment column holds an optional free-text edit comment (currently always `null` from the UI but future-friendly).

The History tab reads from a union of:

1. A synthesised `SUBMITTED` event from `ideas.created_at` + `ideas.author_id`.
2. Every row of `status_transitions` for the idea, classified as either a transition (`from != to`) or an `EDITED` marker (`from = to`).

### Rationale

- Reuses the audit table, the index on `(idea_id, recorded_at)`, the cascade on `ON DELETE`, and the existing security event (`idea_transition`) — zero new infrastructure.
- Encoding the edit marker as `from = to` is the smallest possible widening of the table's grammar; it cannot be mistaken for a real transition by anything reading the state machine.
- The `from = to` constraint *cannot* be exploited to smuggle an arbitrary state change: the state-machine evaluator (`evaluateTransition`) is the only writer that supplies `from != to`; the editIdea service is the only writer that supplies `from = to`. Both invariants live in code adjacent to the only two callers.

### Alternatives considered

| Alternative | Rejected because |
|---|---|
| New table `idea_history`. | Doubles the audit surface for one event kind; harder to keep two tables consistent over time. |
| Boolean `is_edit_marker` column on `status_transitions`. | A second representation of an invariant we can already express with `from = to`; offers no new information. |
| Compute the history from `ideas.updated_at` deltas. | Loses actor + timestamp granularity once a row is touched more than once; not auditable. |

### Consequences

- ✅ History view is a single ORDER BY-and-classify pass over one table.
- ✅ Cascade-on-delete continues to clean up the audit rows when an idea is hard-deleted (Decision 1).
- ✗ Anything joining `status_transitions` and filtering "real transitions only" now needs `WHERE from_state != to_state`. Documented in the repo helper.

Recorded as [ADR-0015](./adr/0015-edited-audit-row.md).

---

## Decision 4 — CSV export streams over `ReadableStream` from the listing query

### Decision

`GET /api/ideas/export` returns `text/csv; charset=utf-8`. The response body is a `ReadableStream` whose pulls are wired to a server-side cursor over the same `ListingQuery` that the listing UI uses, with `pageSize` ignored (export sees every matching row). Rows are escaped per RFC 4180 by the helper at `src/lib/format/csv.ts`. The action is recorded as a `security` event of kind `idea_export` with the actor id, the filter parameters, and the row count.

### Rationale

- Streaming avoids materialising a 10 000-row CSV in Node memory and keeps the SC-006 budget honest even on a modest server.
- Reusing the listing query path guarantees "what you exported matches what you saw" — no second predicate to keep in sync.
- The CSV writer is < 30 LOC because RFC 4180 only requires quoting when a field contains `"`, `,`, or `\r\n`, and quoting itself only requires doubling embedded `"`. No third-party library buys us anything at this size.

### Alternatives considered

| Alternative | Rejected because |
|---|---|
| Buffer the whole CSV in memory. | Easy to write but pushes peak RSS up linearly with the dataset; loses on SC-006 at 10 000 rows. |
| Use `papaparse`, `csv-stringify`, or another lib. | Adds a runtime dep for a 30-LOC formatter; lib surface area greatly exceeds need. |
| Export to XLSX. | Spec asks for CSV; XLSX requires a binary writer (`exceljs`) and a much larger dependency tree. |

### Consequences

- ✅ Memory footprint stays flat regardless of how many rows match.
- ✅ Audit log gets a structured row for every export call (Constitution VII.3 + FR-027).
- ✗ A future "include attachments as a zip" feature would need a different response type and a new ADR.

Recorded as [ADR-0016](./adr/0016-csv-export-streaming.md).

---

## Summary

All `NEEDS CLARIFICATION` markers resolved. Four ADRs follow. Phase 1 design (`data-model.md`, `contracts/openapi.yaml`, `quickstart.md`) is ready to author against this research.
