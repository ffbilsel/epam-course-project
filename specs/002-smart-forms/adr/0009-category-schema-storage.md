# ADR-0009: Store the category field schema inline as a JSON column on `categories`

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-001](../research.md#r-001--how-is-a-categorys-field-schema-persisted), [data-model.md "Entity: CategoryFieldDefinition"](../data-model.md#entity-value-object-categoryfielddefinition), [Constitution VII.3](../../../.specify/memory/constitution.md)

## Context

Phase 2 introduces per-category field schemas. Every read path
that already loads a `Category` row (new-idea form, idea detail
page, admin pages) also wants the schema; no read path filters
categories *by* their schema content. The schema is small (≤ 20
fields, ≤ ~4 KiB of JSON in normal usage) and is a value object
of the owning category — it has no identity outside the category.

Constitution VII.3 mandates a single error vocabulary and Zod
validation at every boundary, but is storage-agnostic; data-model
conventions inherited from Phase 1 require JSON columns to be
parsed by Zod on every load.

## Decision

Persist the schema as **JSON on the category row**:

- Add `field_schema TEXT NOT NULL DEFAULT '[]'` to `categories`.
- The column holds the JSON encoding of a
  `CategoryFieldDefinition[]` (discriminated union by `type`).
- `CategoryRepository.readSchema(id)` and `writeSchema(id, value)`
  are the only points that touch the column; both run
  `CategoryFieldSchema.parse(...)` (Zod) on the way in and out.
- No new tables, no foreign keys, no JSON-index — the column is
  only ever loaded by primary key.

## Consequences

**Positive**

- One SELECT per read; no JOIN. The hot read path (new-idea form
  → load every `ACTIVE` category) is exactly the Phase 1 path,
  plus a slightly larger row payload.
- The schema is **deletable as a unit** — overwrite the column
  with `'[]'` to clear all fields atomically (used by tests).
- The migration is one `ALTER TABLE` with a safe default;
  existing categories migrate to a no-op schema with zero
  application-level changes (the editor and the new-idea form
  treat `[]` identically to "no schema column").
- `pages.tsx` server components can load `Category` + schema in
  the same Drizzle query they already issue.

**Negative**

- Cannot SQL-query "all fields of type LONG_TEXT across all
  categories" without parsing the JSON application-side. This is
  not a Phase 2 use case; future analytics phases that need such
  queries would either reshape the data or use SQLite's `json_*`
  functions.
- A malformed JSON write would corrupt the column; mitigated by
  Zod-on-write (we never persist anything `safeParse` did not
  accept).

## Alternatives considered

1. **Separate `category_fields` (+ `category_field_options`)
   tables.** Rejected: doubles the migration size, adds cascade
   rules to maintain, requires `ORDER BY position` on every read.
   Premature normalisation for ≤ 8 fields/category.
2. **External YAML config in the repo.** Rejected: breaks SC-005
   ("admin sees change within one minute, no deployment") and the
   multi-replica story that future phases will introduce.
3. **A dedicated 1-to-1 `category_schemas` table.** Rejected:
   1-to-1 with the owning category is a column, not a table.
