# Phase 0 Research — Smart Submission Forms

This document captures the load-bearing **decisions**, the
**rationale**, and the **alternatives considered** that shape the
Phase 2 plan. Each decision distils to an ADR under
[./adr/](./adr/); the ADR is the authoritative reference and wins
when prose here ever disagrees.

The spec carries **no** `[NEEDS CLARIFICATION]` markers; every
"unknown" below is a self-imposed design question we resolved
before writing the plan, not a clarification request.

---

## R-001 — How is a category's field schema persisted?

**Decision**: store the schema **inline** on the `categories` row
as a `TEXT` column (`field_schema`) holding the JSON-encoded
`CategoryFieldDefinition[]`. The column defaults to `'[]'` so
existing categories migrate to a no-op schema. Reads parse the JSON
through a Zod schema (`CategoryFieldSchema`); writes serialise after
the same Zod validation succeeds.

**Rationale**:

- Schemas are **always loaded together with their category** (every
  call site that already loads a category needs the schema too); a
  child table would force a second SELECT or a JOIN on the hot
  read path.
- SQLite has no native JSON type but ships `json_*` functions; we
  do not need predicate queries on the schema, only "load by id /
  save by id", which the JSON column supports trivially.
- The 20-field × 1 KiB cap (Technical Context) keeps row size well
  under SQLite's page budget.
- The schema is a **value object** of the category, not an
  independent entity — it has no identity outside the category.

**Alternatives considered**:

- **Separate `category_fields` table.** Rejected: adds two new
  tables (fields + options) with cascade rules to maintain, doubles
  the migration size, and forces an `ORDER BY position` on every
  read. The current scale (≤ 8 fields/category) does not justify
  the relational overhead.
- **External config file (YAML on disk).** Rejected: violates Story
  3's "no deployment, change reflects within a minute" requirement
  (SC-005) and breaks the multi-replica story future phases will
  bring.
- **A dedicated `category_schemas` table keyed by `category_id`.**
  Rejected: 1-to-1 with `categories`; that's a column, not a table.

**ADR**: [ADR-0009](./adr/0009-category-schema-storage.md).

---

## R-002 — How are submitted answers persisted and how do we keep historical answers readable after a schema edit?

**Decision**: store answers **inline** on the `ideas` row as a
`TEXT` column (`category_answers`) holding the JSON-encoded
`StructuredAnswer[]`. **Each `StructuredAnswer` carries a
**`labelSnapshot`** field captured from the schema at submission
time.** When the detail page renders, it uses `labelSnapshot` for
every answer; the live schema is only consulted to know the
**display order** of fields that still exist.

**Rationale**:

- FR-008 requires that "when a stored answer's underlying field has
  been removed from the category schema, the detail page MUST still
  display the answer using the label that was in effect when the
  answer was saved." A label snapshot per answer is the simplest
  realisation: no extra table, no temporal join.
- FR-010 requires schema edits to never mutate stored answers —
  trivially satisfied because schema and answers live in different
  rows.
- Answers are always loaded with their idea (idea detail page,
  reviewer queue future filter), so co-location is again the cheap
  read.

**Alternatives considered**:

- **`idea_field_answers` child table.** Rejected for the same
  reasons as R-001 (extra table, extra JOIN, ORDER BY) plus an
  ambiguity in how to encode "label at the time": either an extra
  column (which is just JSON-in-rows) or a temporal table (vast
  over-engineering for Phase 2).
- **Re-resolve labels from category schema on read.** Rejected:
  fails FR-008 once a field is removed; we would need a separate
  "trash" of removed fields, which is strictly more storage than
  the snapshot.
- **Versioned schema with `schema_version_id` per idea.** Rejected:
  multiplies the schema row count by N versions per category and
  forces a JOIN on detail; the label-snapshot approach achieves the
  same historical fidelity with O(1) reads.

**ADR**: [ADR-0010](./adr/0010-answer-storage-and-label-snapshot.md).

---

## R-003 — How is the category-specific validation expressed so that it runs on both the client and the server?

**Decision**: the schema's `CategoryFieldDefinition[]` is converted
to a **Zod schema at runtime** by a pure builder function
`buildAnswersZodSchema(fields)` in
`src/lib/validation/category-fields.ts`. The builder returns a
`z.ZodObject` whose shape is keyed by field `key` and whose
per-field validator is composed from the field's `type`,
`required` flag, and (for `SINGLE_CHOICE`) `options`. **Both the
client** (passed to `@hookform/resolvers/zod`) and **the server**
(`safeParse` inside `IdeaService.create`) consume the very same
function output.

**Rationale**:

- Constitution VII.3 mandates Zod-everywhere and rejects hand-rolled
  per-route validators; the meta-schema reuses the existing
  primitives without inventing a new validator framework.
- One builder, two consumers → impossible for the client and server
  to disagree on what counts as valid input.
- The builder is a pure function over a small descriptor → testable
  with `it.each` table-driven cases.

**Alternatives considered**:

- **A JSON-Schema validator** (`ajv` or similar). Rejected: adds a
  runtime dependency, splits the validator stack (Zod for fixed
  shapes, ajv for dynamic), and breaks the JSDoc + inference story
  TypeScript gives us with Zod.
- **Build two separate validators**, one in the client form and
  one in the route handler. Rejected: violates the "single source
  of truth for validation" rule in Constitution VII and reopens
  the drift the rule exists to prevent.
- **Send the schema as JSON Schema to the client and trust it
  there.** Rejected: trusting the client is a non-starter; the
  server must validate independently. With our builder, both do.

**ADR**: [ADR-0011](./adr/0011-dynamic-zod-validation.md).

---

## R-004 — What field types ship in Phase 2 and how is the taxonomy extensible without an ADR per future type?

**Decision**: ship exactly **five** field types, each a tag in a
discriminated union on `type`:

| Tag             | Renderer (shadcn) | Storage  | Constraints                                  |
|-----------------|-------------------|----------|----------------------------------------------|
| `SHORT_TEXT`    | `Input`           | `string` | ≤ 120 chars (matches `IDEA_TITLE_TOO_LONG`)  |
| `LONG_TEXT`     | `Textarea`        | `string` | ≤ 2 000 chars (matches `IDEA_DESCRIPTION_TOO_LONG`) |
| `NUMBER`        | `Input type=number` | `number` | optional `min`/`max`; finite, not NaN      |
| `SINGLE_CHOICE` | `RadioGroup`      | `string` | value MUST be one of `options[].value`       |
| `YES_NO`        | `Switch`          | `boolean`| —                                            |

The discriminator is `type`. Adding a new type requires (a) a new
tag, (b) a new branch in the Zod builder, (c) a new branch in the
renderer, and (d) an ADR amendment that supersedes ADR-0012.

**Rationale**:

- Five types cover every example surfaced when drafting the spec
  (current-process narrative, pain-point summary, estimated time
  saved, audience selector, is-it-customer-facing). Adding more is
  cheap **per ADR**, but each addition is a load-bearing choice
  and gets its own ADR by Constitution IX.
- The cap aligns the long-text limit with the existing Phase 1
  description cap, so a single error code
  (`IDEA_ANSWER_TOO_LONG`) covers both.
- Discriminated unions give us exhaustive `switch` checking under
  `noFallthroughCasesInSwitch`.

**Alternatives considered**:

- **Free-form "metadata" type that accepts arbitrary JSON.**
  Rejected: defeats the typing story, leaks UI concerns into the
  validator, and gives reviewers no display contract.
- **File / Date / Multi-select.** Deferred — Phase 3 owns
  multi-file (so we do not duplicate the attachment story here),
  Date adds locale/timezone questions the spec does not need,
  Multi-select adds collection-cardinality semantics that
  significantly enlarge the validator surface for marginal Phase 2
  value.

**ADR**: [ADR-0012](./adr/0012-field-type-taxonomy.md).

---

## R-005 — Where does the schema editor live and how does it interact with the category-lifecycle (`ACTIVE` / `PROPOSED` / `REJECTED`)?

**Decision**: extend the existing admin category page
(`src/app/(admin)/admin/categories/page.tsx`) with a per-row "Edit
schema" link, navigating to a dedicated editor page at
`/admin/categories/[id]/schema`. Only categories in `ACTIVE`
state expose the link and the page; the route handler also enforces
state at the API boundary (`PUT /api/categories/:id/schema` returns
`409 CATEGORY_NOT_ACTIVE` — a new Phase 2 code — when the
category is not `ACTIVE`).

**Rationale**:

- Reuses the existing role-guard pattern from Phase 1
  (`requireRole("ADMIN")`); no new authz code paths.
- Categorically prevents schema work on `PROPOSED` categories per
  FR-011 (a proposed category has not yet been blessed by an admin
  and has zero ideas).
- Editing `REJECTED` categories has no user; gating to `ACTIVE`
  keeps the contract minimal.

**Alternatives considered**:

- **Inline schema editor on the existing categories page.**
  Rejected: cramped on mobile, makes the existing page's empty/
  loading/error states harder to keep clean, and removes the
  natural URL for deep-linking from a future "schema diff" tool.

---

## R-006 — How does the new-idea form preserve user input when the user switches category mid-fill?

**Decision**: the React Hook Form holds a flat `answers` object
keyed by field `key`. On a category change the form **keeps every
value whose key is in the intersection** of the old and new
category schemas, and clears the rest. Keys are namespaced inside
`answers` so they cannot collide with the core fields (`title`,
`description`, `categoryChoice`).

**Rationale**:

- Implements FR-004 deterministically and predictably.
- The form keeps a single flat shape so React Hook Form's
  `unregister` (with `keepDefaultValue: false`) handles cleanup
  without imperative state.
- Field `key`s are author-chosen identifiers (`current_process`,
  `pain_point`); collisions between categories on the same key
  semantically mean "the same question, ask it once" — exactly the
  preservation behaviour the user expects.

**Alternatives considered**:

- **Always clear all extra fields on category change.** Rejected:
  violates FR-004 and frustrates the common case of "I picked the
  wrong category, let me switch and keep my notes".
- **Per-category form state.** Rejected: adds a state-machine of
  its own and surprises users when their input quietly resurfaces
  from a category they no longer want.

---

## R-007 — How are new error codes wired in without forking the Phase 1 envelope?

**Decision**: append the nine new codes to the existing
`src/lib/errors/codes.ts` registry, give each the appropriate
HTTP-status mapping (validation → 400, conflict → 409), add a
UI-copy entry to `src/lib/errors/error-messages.ts`, and add one
unit test per code as required by Quality Gate #9. The error
envelope and `withErrorHandler` HOC are unchanged.

**Rationale**:

- The Phase 1 envelope already supports `details` — we use it to
  carry `{ field: "<key>", reason: "<sub-code>" }` so the UI can
  highlight the offending dynamic field by `name=answers.<key>`.
- No new envelope shape ⇒ no integration-test rewrites against the
  Phase 1 contract.

**Alternatives considered**:

- **Reuse `VALIDATION_ERROR` for everything.** Rejected:
  Constitution VII.3 forbids generic codes and the spec
  distinguishes "required", "out of range", "option invalid",
  etc., each of which gets its own UI copy.

---

## Inputs into Phase 1 Design

The decisions above directly feed the artefacts produced in Phase
1 of this plan:

- R-001, R-002 → [data-model.md](./data-model.md) (new columns,
  JSON shapes, invariants).
- R-003, R-004 → [contracts/openapi.yaml](./contracts/openapi.yaml)
  (request/response schemas, error responses).
- R-005, R-006 → component tree in [plan.md "Project Structure"](./plan.md#project-structure)
  and the integration tests listed in [quickstart.md](./quickstart.md).
- R-007 → new entries in `src/lib/errors/codes.ts` (Quality Gate #9).

All `[NEEDS CLARIFICATION]` from the spec template are resolved
(there were none).
