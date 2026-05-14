# Phase 0 — Research: Advanced Evaluation Experience

**Feature**: `004-advanced-evaluation-experience`
**Date**: 2026-05-14
**Status**: Complete — every `NEEDS CLARIFICATION` from the spec is
resolved here.

## Inputs

- [spec.md](./spec.md) — 5 user stories, 38 functional requirements,
  8 non-functional requirements, 9 success criteria, 3 clarifications.
- [plan.md](./plan.md) — technical context, structure, constitution
  check.
- Constitution v1.4.0 (`.specify/memory/constitution.md`).
- Existing codebase: Phase-1 state machine + auth + roles; Phase-2
  category `fieldSchema` + per-idea `categoryAnswers`; Phase-3
  listing query (`ListingQuery`), `status_transitions` table widened
  with the `EDITED` audit-row encoding.

## Clarifications resolved

### Clarification 1 — Anonymous toggle owner

**Resolution**: Per-category default (`categories.anonymous_default`)
plus an **Admin** per-idea override at submission time. Submitters do
**not** toggle anonymity in v1.

**Rationale**:

- Keeps the trust model simple: anonymity is governance, not
  self-service. A Submitter requesting anonymity on their own
  competitive idea is exactly the case the spirit of anonymity is
  designed against (anonymity protects *the submitter's identity from
  the reviewer*, not *the idea's content from competing submitters*).
- The category default carries 90 % of the policy — most "Diversity &
  Inclusion"-style categories will be configured anonymous once and
  inherited forever; the Admin per-idea override handles the rare
  exception. Adding a third toggle (Submitter request) introduces a
  three-way conflict-resolution UX nobody asked for.
- Keeps the database simple: a single boolean on the idea row,
  snapshotted from the category default at submission, mutable only
  by an Admin afterwards.

**Implications**:

- FR-021 is implemented as: at `POST /api/ideas` (and at
  `POST /api/drafts/:id/submit`) the server reads
  `categories.anonymous_default` and writes it into
  `ideas.anonymous`. An optional `?anonymous=true|false` query
  parameter is accepted **only when the requester's role is ADMIN**;
  any other role passing it is rejected with `FORBIDDEN`.
- Admins may toggle `ideas.anonymous` at any time via the existing
  admin idea-detail page; the change takes effect on subsequent reads
  (no historical comment renaming — see FR-022 last bullet).
- Recorded as [ADR-0018](./adr/0018-anonymity-model.md).

### Clarification 2 — Reviewer assignment model

**Resolution**: **Unchanged from Phase 3.** Any EVALUATOR may pick up
any idea in `SUBMITTED` (move it to `UNDER_REVIEW`) and any idea in
`UNDER_REVIEW`. Multiple EVALUATORs may each record their own
per-dimension scores on the same idea. The *deciding* EVALUATOR's
required-dimension check (FR-013) is the gate that blocks Approve /
Reject when a required dimension is unscored. Once *any* EVALUATOR
decides, that EVALUATOR's ratings lock; other EVALUATORs' ratings
remain editable until they themselves decide (which, post-decision,
they typically will not). Comment thread is visible to the author,
to every EVALUATOR who has rated or commented on the idea, and to
every Admin.

**Rationale**:

- Phase 3 already established the "any reviewer in queue" model. The
  Phase-4 brief does not introduce assignment, so changing the
  assignment model here would be scope creep.
- The required-dimension gate is a property of the deciding
  evaluator's ratings, not of the *aggregate* across evaluators —
  this avoids the edge case where Evaluator A scores everything and
  Evaluator B (who skipped the dimensions) tries to decide and is
  blocked by someone else's scores. Each decider supplies their own
  evidence.

**Implications**:

- The `ratings` table is keyed by `(ideaId, evaluatorId, dimensionId)`
  with no "assigned reviewer" concept.
- Visibility of an EVALUATOR's ratings to other EVALUATORs is opt-in
  for v1: each EVALUATOR sees their own ratings live and sees other
  EVALUATORs' ratings only after those have been locked by a decision
  (prevents anchoring before deciding). This satisfies FR-014 read
  literally ("each reviewer's per-dimension scores attributed to that
  reviewer") while honouring the spec's intent.
- Recorded as part of [ADR-0019](./adr/0019-ratings-schema.md).

### Clarification 3 — Chart library / rendering technology

**Resolution**: **Recharts** (`recharts ^2.12`). One new runtime
dependency, lockfile-pinned.

**Rationale**:

- Recharts is the React-idiomatic chart library used heavily in the
  shadcn/ui ecosystem; the official shadcn `chart` component is
  literally a thin Recharts wrapper. This makes "Story 4 charts +
  Story 5 makeover share a visual language" essentially free.
- Server side renders to SVG, plays well with React 18 client
  components, ships ARIA roles out of the box, and respects
  `prefers-reduced-motion` via prop. Hand-rolling SVG components
  (option 1 below) would re-invent ~90 % of these affordances.
- Bundle cost (`~70 kB gzipped` for the three chart types we need) is
  acceptable for an Admin-only / Evaluator-only surface that lazy-
  loads.

**Alternatives considered**:

| Option | Rejected because |
|---|---|
| Hand-rolled SVG components | Re-implementing legends, tooltips, axis ticks, hover state, keyboard focus, and `prefers-reduced-motion` for three chart types is the kind of unbounded yak-shave the spec specifically warns against. |
| Chart.js (Canvas) | Canvas charts are not screen-reader accessible without extra ARIA scaffolding; the spec demands WCAG AA on every new surface (NFR-005). |
| Visx | Lower-level than Recharts (you assemble the chart from primitives). Worth it when you need bespoke visualisations; not worth it for three off-the-shelf chart types. |
| `@nivo/*` | Bundle larger than Recharts for the same visual set; extra peer-dep complexity. |
| ECharts | Excellent but huge (≥ 200 kB gzipped); imperative API does not fit RSC well. |

- Recorded as [ADR-0021](./adr/0021-recharts-as-chart-engine.md).

---

## Decision 1 — Drafts live in their own table, not as a lifecycle state

**Decision**: Phase 4 introduces a new `idea_drafts` table holding
draft rows owned by an author. Submitting a draft creates a fresh
`ideas` row in `SUBMITTED` and deletes the draft row in the same
transaction. The idea state machine grammar is **unchanged** — no
`DRAFT` state is added.

**Rationale**:

- A `DRAFT` lifecycle state would force every read path (listing,
  history, transitions, exports, insight charts) to filter `status !=
  'DRAFT'`. Adding one filter to every query is exactly the
  consistency tax FR-003 / NFR-004 are written to avoid.
- A separate table makes "drafts are private to their author" a
  *physical* property (the table has no public read path) rather than
  a policy applied on top of a shared table. Easier to reason about,
  easier to test (SC-005-equivalent: zero reviewer-facing endpoints
  even mention `idea_drafts`).
- Submitting a draft cleanly transitions ownership: the draft row is
  destroyed, the idea row is born in `SUBMITTED`, the security event
  is a single `idea_submitted` (no need to fabricate a transition
  from a `DRAFT` pseudo-state).

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| `DRAFT` as a sixth idea status | Pollutes every listing/insight query with a filter; risks data leaks if a single query forgets the filter; the state machine grammar widens without buying expressive power. |
| Promote-in-place (draft row becomes the idea row) | Acceptable per the spec's Assumptions but the resulting `ideas` row carries draft-era timestamps that confuse the audit log and the listing's "newest first" ordering. The "fresh row on submit" approach is just as easy to implement and avoids the foot-gun. |
| Local-storage-only drafts | Loses cross-device drafts (the spec explicitly cites "logs back in later") and is unrecoverable on browser-cache eviction. Not viable. |

- Recorded as [ADR-0017](./adr/0017-drafts-separate-table.md).

---

## Decision 2 — Rating dimensions are category-scoped with a default set

**Decision**: A new `rating_dimensions` table holds dimensions; rows
with `category_id IS NULL` are the **default set** seeded with the
migration (Feasibility, Impact, Originality, Alignment). A category
"overrides" the defaults by having its own non-null rows; when a
category has any rows, those replace the defaults wholesale (no
mixing).

A new `ratings` table holds per-(idea, evaluator, dimension) scores
with a nullable `score` (1..5, null = "unrated"). When an EVALUATOR
records a decision (`UNDER_REVIEW → APPROVED | REJECTED`) the
service stamps `locked_at = now()` on every `ratings` row for that
`(idea, evaluator)` pair; locked rows are read-only.

Rating-dimension reconfiguration is **non-destructive**: removing a
dimension flips `active = 0` but keeps the row so historical scores
referencing its id still render with the original label and an
"(deprecated)" suffix (FR's "Edge Cases", bullet 2).

**Rationale**:

- One dimension set per category is a clean mental model. Mixing
  "defaults + category-specific" rows at runtime is a known
  configuration footgun (Phase-2 `fieldSchema` already taught us this
  lesson).
- Lock-on-decide is what FR-012 + FR-013 demand. Locking only the
  deciding evaluator's rows (not "everybody's") preserves the
  multi-evaluator model decided in Clarification 2.
- Soft-deletion via `active` flag preserves the audit story and the
  history tab's ability to render past decisions truthfully.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| One row per (idea, dimension) — global, not per-evaluator | Conflicts with FR-014 ("each reviewer's per-dimension scores attributed to that reviewer"); requires a separate "who scored what" join table anyway. |
| Versioned dimension rows (insert new row on edit) | Useful but solves a problem (rename history) the spec does not require; clutters the schema. |
| Store dimensions as JSON inside `categories.field_schema` | Conflates two schemas (category fields vs. rating dimensions) and breaks the per-rating foreign key. |

- Recorded as [ADR-0019](./adr/0019-ratings-schema.md).

---

## Decision 3 — Comments are one table with one-level nesting and soft delete

**Decision**: A single `comments` table; `parentId` is nullable and,
when present, must reference a top-level comment (a comment whose own
`parentId` is null). The service rejects a POST with a `parentId`
that itself has a `parentId` (`COMMENT_NESTING_EXCEEDED`). The
decision comment recorded at Approve / Reject is inserted as a
top-level row with `kind = 'DECISION'` so the thread shows it inline
in chronological order.

Edit/delete by the author is permitted for 5 minutes after
`created_at`; after that, the row is immutable to the author. Admins
may soft-delete any comment (`deleted_at` + `deleted_by_id`); the UI
renders the slot as "[comment removed by moderator]" (FR-020).
Comments are stored as plain text; rendering is `escapeHtml(text)
→ replace(\n, '<br>')` (NFR-007).

**Rationale**:

- One level of nesting handles the "ask a clarifying question, get an
  answer" pattern in the spec without inviting unbounded reply trees.
- Soft-delete preserves thread coherence; hard-delete leaves orphan
  replies whose context vanishes.
- Storing plain text + escape-on-render is XSS-immune by
  construction; no sanitiser dependency is required.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Unlimited nesting via `parentId` | UI complexity grows without bound; spec explicitly bounds at one level. |
| Markdown body | Out of scope per the spec's Assumptions ("plain text + line breaks only in v1"); a sanitiser dependency would be required. |
| Separate `decision_comments` table | Duplicates the comment schema; defeats FR-019's "decision lives in the thread". |

- Recorded as [ADR-0020](./adr/0020-comment-thread-shape.md).

---

## Decision 4 — Anonymity is a server-side projection, snapshotted on submit

**Decision**: `categories.anonymous_default` (0/1) + `ideas.anonymous`
(0/1). At submission time the service writes
`ideas.anonymous = categories.anonymous_default` (or the Admin's
explicit override). On every read path, the server applies
`maskAuthor(idea, viewer)`:

```text
maskAuthor(idea, viewer) →
  if idea.anonymous and viewer.role = 'EVALUATOR' and viewer.userId != idea.authorId:
    return { authorId: null, authorName: 'Anonymous Submitter',
             authorEmail: null, authorAvatarUrl: null }
  else:
    return idea.author  // unmasked
```

The same helper is applied to history events authored by the
submitter (`SUBMITTED`, `EDITED`, comments where author = submitter)
and to chart tooltips that would otherwise reveal a per-submitter
count. Admin views never mask.

**Rationale**:

- One pure helper, one boolean per row → zero risk of "the queue
  page masks but the detail page forgets". The integration suite
  asserts SC-005 by spinning up an anonymous idea and crawling every
  EVALUATOR-facing endpoint, asserting none of the submitter's
  identifying fields appear in the response.
- Snapshotting on submit (FR-023) means re-categorising or flipping
  the category default later does not retroactively un-mask or mask
  existing ideas — the idea's own flag is the truth.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Compute anonymity from category at read time | Violates FR-023 (re-toggling the category default would retroactively rewrite anonymity, surprising users). |
| Two separate `users` rows for "real" vs "anonymous" identity | Massive over-engineering; complicates auth and audit; nothing the spec asks for. |
| Encrypt the submitter id and decrypt only for Admin | Cryptographic complexity for a property that is fundamentally a server-side authorisation rule; key management out of scope. |

- Recorded as [ADR-0018](./adr/0018-anonymity-model.md).

---

## Decision 5 — Insights are computed on demand by three aggregator queries

**Decision**: Each Insights chart corresponds to a single REST
endpoint that runs one covering SQL query over `ideas` (joined to
`status_transitions` where the chart needs decision data) and returns
a small JSON payload. No materialised view, no cron, no separate
analytics store. The endpoints honour anonymity and role-scope
server-side: an EVALUATOR hitting `/api/insights/category-distribution`
gets the same shape as an Admin but with `bySubmitter` omitted.

The Recharts components are **client components** that fetch their
endpoint via SWR (already a transitive dep). Each chart has its own
loading skeleton + empty state. Range changes trigger one network
request per chart; the three requests are parallelised by the page.

**Rationale**:

- At the spec's scale (≤ 10 000 ideas), the three aggregator queries
  each run in single-digit milliseconds against the indexes already
  added in Phase 3 plus the one new index in Phase 4
  (`idx_ideas_status_created`). NFR-001 (≤ 2 s per chart) is met with
  three-orders-of-magnitude headroom.
- Computing on demand keeps the moving parts small. A cron-refreshed
  cache would deliver stale data and add an admin "rebuild snapshot"
  UI nobody asked for.
- Splitting into three endpoints (vs. one fat `/api/insights`) lets
  each chart fail / skeleton-load independently (Constitution VI.3)
  and lets us add a fourth chart later without disturbing the others.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| One fat endpoint returning all charts' data | Couples chart failure modes; precludes per-chart caching. |
| Materialised view refreshed on transition | Adds maintenance; overkill at 10 000 ideas. |
| External analytics (Metabase / Superset) | New service, new auth surface; out of scope. |

- Recorded as [ADR-0021](./adr/0021-recharts-as-chart-engine.md)
  (the Recharts decision) and is informationally referenced by the
  insights service docs.

---

## Decision 6 — Design tokens + dark mode via CSS variables

**Decision**: The makeover introduces a single token file
(`src/styles/tokens.css`) defining CSS variables for color (in
HSL triplets matching the shadcn convention), spacing scale, radius,
shadow, and font sizes. The Tailwind config consumes these variables
via `tailwind.config.ts` so utility classes (`bg-primary`,
`rounded-md`, `text-sm`) remain the source of truth. Dark mode is
implemented as a `.dark` class on `<html>` that re-binds the same
variables — every page, every component, every chart inherits the
swap "for free".

The shared `AppShell` (top nav + role-aware sidebar) wraps every
authenticated page; per-page chrome is removed.

**Rationale**:

- This is the canonical shadcn/ui theming pattern. Adopting it costs
  one config file and one wrapper component; the rest of the
  makeover is sweeping through pages and replacing one-off styles
  with shadcn primitives, which is mechanical.
- Recharts is wired to read the same variables (its `<CartesianGrid>`
  stroke, axis text, and tooltip background all consume CSS vars) so
  dark-mode parity in charts is automatic.

**Alternatives considered**:

| Alternative | Rejected because |
|---|---|
| Hard-coded `dark:` variants on every utility class | Doubles class-name noise; harder to keep in sync; hostile to design-token swaps. |
| Theming via a React context + style-prop | Breaks Constitution VII.1 ("no inline `style` props outside `src/components/ui/`"); no SSR parity. |
| Two separate Tailwind themes (one CSS, one JS) | Maintenance burden; goal is *one* design system. |

- Recorded as [ADR-0022](./adr/0022-makeover-design-tokens.md).

---

## Summary table — decisions → ADRs → spec coverage

| # | Decision | ADR | Covers |
|---|---|---|---|
| 1 | Drafts in own table | 0017 | FR-001…008, NFR-004 |
| 2 | Anonymity snapshot + Admin override | 0018 | FR-021…024, NFR-003, NFR-008, SC-005 |
| 3 | Ratings schema + lock-on-decide | 0019 | FR-009…015 |
| 4 | Comment thread shape | 0020 | FR-016…020, NFR-007 |
| 5 | Recharts | 0021 | FR-025…031, NFR-001 |
| 6 | Design tokens + dark mode | 0022 | FR-032…036, NFR-005 |

Hardening items (FR-037 Employee dashboard History tab, FR-038
review-queue status filter) reuse Phase-3 infrastructure
(`ListingQuery`, `useListingQuery`) and require no new ADR; they are
covered by integration tests `employee-history-tab.test.ts` and
`queue-status-filter.test.ts`.
