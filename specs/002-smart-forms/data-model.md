# Phase 1 Data Model — Smart Submission Forms

This document defines the entities and storage shapes introduced by
Phase 2. It is **additive** to the Phase 1 data model at
[specs/001-innovatepam-portal-mvp/data-model.md](../001-innovatepam-portal-mvp/data-model.md).
The Phase 1 entities (`User`, `Idea`, `Attachment`, `Category`,
`StatusTransition`, `BootstrapAdminMarker`) are unchanged in their
core columns, indexes, and invariants.

## Conventions

Inherited from Phase 1 (see `../001-…/data-model.md`):

- IDs are UUID v4 text (`crypto.randomUUID()`).
- Timestamps are Unix-epoch milliseconds (`INTEGER`).
- String enums use `TEXT` with a CHECK constraint and an exported
  `as const` object in `src/db/schema.ts`.
- Foreign keys default to `ON DELETE RESTRICT`.
- JSON columns are validated by Zod at every load **and** every
  store.

Phase 2 introduces **two new TEXT columns holding JSON**:

| Table         | Column            | Default | Constraint                                           |
|---------------|-------------------|---------|------------------------------------------------------|
| `categories`  | `field_schema`    | `'[]'`  | Valid JSON; parses against `CategoryFieldSchema`     |
| `ideas`       | `category_answers`| `'[]'`  | Valid JSON; parses against `IdeaCategoryAnswersList` |

`CHECK(json_valid(<col>))` is **not** added (SQLite's `json_valid`
varies by build) — Zod is the source of truth and rejects invalid
content at the application boundary.

---

## Schema delta (`drizzle/0001_smart_forms.sql`)

```sql
-- Phase 2: Smart Submission Forms
ALTER TABLE categories
  ADD COLUMN field_schema TEXT NOT NULL DEFAULT '[]';

ALTER TABLE ideas
  ADD COLUMN category_answers TEXT NOT NULL DEFAULT '[]';
```

The migration is **idempotent under SQLite** (Drizzle re-runs are
gated by `drizzle/meta/_journal.json`). Existing rows pick up the
defaults; no data backfill is required.

---

## Entity (value object): CategoryFieldDefinition

An ordered element of a category's schema. **Not** a database row;
it is a tagged member of the JSON array stored in
`categories.field_schema`.

### Shape (discriminated union by `type`)

| Field      | Type                                                   | Notes                                                       |
|------------|--------------------------------------------------------|-------------------------------------------------------------|
| `key`      | `string`                                               | Stable identifier, `^[a-z][a-z0-9_]{0,39}$`. Unique within the category. |
| `label`    | `string`                                               | 1–80 chars; sentence case (Constitution VII.1).             |
| `helpText` | `string` *(optional)*                                  | 0–160 chars; rendered below the input.                      |
| `type`     | `'SHORT_TEXT' \| 'LONG_TEXT' \| 'NUMBER' \| 'SINGLE_CHOICE' \| 'YES_NO'` | Discriminator. |
| `required` | `boolean`                                              | Required for submission when `true`.                        |

**Per-type extras** (extend the union):

- **`SHORT_TEXT`**: no extras. Max 120 chars.
- **`LONG_TEXT`**: no extras. Max 2 000 chars.
- **`NUMBER`**: `{ min?: number; max?: number }`. Values MUST be
  finite (`Number.isFinite`), MUST NOT be `NaN`, MUST satisfy
  `min ≤ v ≤ max` when bounds are present.
- **`SINGLE_CHOICE`**: `{ options: Array<{ value: string; label: string }> }`.
  `options.length ≥ 1`. `value` matches `^[a-z][a-z0-9_]{0,39}$`
  and is unique within the field. `label` 1–80 chars.
- **`YES_NO`**: no extras.

### JSON example

```json
[
  {
    "key": "current_process",
    "label": "Describe the current process",
    "type": "LONG_TEXT",
    "required": true
  },
  {
    "key": "estimated_hours_saved_per_week",
    "label": "Estimated hours saved per week",
    "type": "NUMBER",
    "required": true,
    "min": 0,
    "max": 168
  },
  {
    "key": "audience",
    "label": "Who benefits most?",
    "type": "SINGLE_CHOICE",
    "required": false,
    "options": [
      { "value": "engineering", "label": "Engineering teams" },
      { "value": "delivery",    "label": "Delivery teams" },
      { "value": "everyone",    "label": "Everyone" }
    ]
  },
  {
    "key": "customer_facing",
    "label": "Is the impact customer-facing?",
    "type": "YES_NO",
    "required": false
  }
]
```

### Invariants (enforced by `CategoryFieldSchema` in `src/lib/validation/category-fields.ts`)

1. `length ≤ 20`.
2. `key` values are unique within the array.
3. Each field passes its per-type sub-schema.
4. A field whose `type = 'SINGLE_CHOICE'` MUST have `options.length ≥ 1`.

Violations throw `AppError(CATEGORY_SCHEMA_INVALID)` with
`details: { field: <key>, reason: <sub-code> }` where `<sub-code>`
is one of `FIELD_DUPLICATE`, `OPTION_REQUIRED`, `LABEL_TOO_LONG`,
`KEY_INVALID`, `BOUND_INVERTED`.

### Error codes added

| Code                                  | HTTP | When |
|---------------------------------------|------|------|
| `CATEGORY_SCHEMA_INVALID`             | 400  | Generic schema-shape failure (catch-all parsed by Zod) |
| `CATEGORY_SCHEMA_FIELD_DUPLICATE`     | 400  | Two fields share a `key` |
| `CATEGORY_SCHEMA_OPTION_REQUIRED`     | 400  | `SINGLE_CHOICE` saved with empty `options` |
| `CATEGORY_NOT_ACTIVE`                 | 409  | Schema edit attempted on a non-`ACTIVE` category (FR-011) |

---

## Entity (value object): IdeaStructuredAnswer

An answer captured at submission time for one
`CategoryFieldDefinition`. Stored as a JSON array on
`ideas.category_answers`.

### Shape

| Field                | Type                              | Notes                                                |
|----------------------|-----------------------------------|------------------------------------------------------|
| `key`                | `string`                          | Matches `CategoryFieldDefinition.key` at submit time |
| `labelSnapshot`      | `string`                          | Copy of the field's `label` at submit time (FR-008)  |
| `type`               | `CategoryFieldDefinition['type']` | Discriminator copied for forward compatibility       |
| `value`              | `string \| number \| boolean`     | Typed per the discriminator (see below)              |
| `valueLabelSnapshot` | `string` *(SINGLE_CHOICE only)*   | Copy of the chosen `option.label` at submit time so that the detail page survives later option renames or removals (FR-008 / spec Edge Case: "Single-choice options changing after the fact") |

**Per-type `value`**:

- `SHORT_TEXT`, `LONG_TEXT`: `string` (trimmed; ≤ Phase-1 caps).
- `NUMBER`: `number` (finite).
- `SINGLE_CHOICE`: `string` (one of the option `value`s **at
  submission time**; the option list at read time may differ).
  `valueLabelSnapshot` carries the matching `option.label` at
  submission time and is the **only** string rendered on the
  detail page for this answer.
- `YES_NO`: `boolean`.

Optional fields with no answer are **omitted from the array
entirely** (not stored as `null`). This keeps "answered vs not
answered" unambiguous and aligns the read path: an empty optional
answer simply does not appear and the detail panel never renders
it.

### JSON example (for an idea in the *Process Improvement* category)

```json
[
  {
    "key": "current_process",
    "labelSnapshot": "Describe the current process",
    "type": "LONG_TEXT",
    "value": "We currently file regression tickets by emailing the QA dist list…"
  },
  {
    "key": "estimated_hours_saved_per_week",
    "labelSnapshot": "Estimated hours saved per week",
    "type": "NUMBER",
    "value": 6
  },
  {
    "key": "customer_facing",
    "labelSnapshot": "Is the impact customer-facing?",
    "type": "YES_NO",
    "value": false
  },
  {
    "key": "audience",
    "labelSnapshot": "Who benefits most?",
    "type": "SINGLE_CHOICE",
    "value": "engineering",
    "valueLabelSnapshot": "Engineering teams"
  }
]
```

### Invariants (enforced by `validateAnswers` in `src/server/category-answers.ts`, backed by the Zod meta-schema in `src/lib/validation/category-fields.ts`)

1. `length ≤ 20`.
2. `key`s are unique within the array.
3. Every `key` in the array MUST appear in the category's
   `field_schema` **at the moment of submission**.
4. Every `required: true` field in the schema MUST have a matching
   answer.
5. Each `value` passes its per-type sub-schema (length, range,
   option membership).

Violations throw `AppError` with one of:

| Code                       | HTTP | When |
|----------------------------|------|------|
| `IDEA_ANSWER_REQUIRED`     | 400  | A required field has no answer |
| `IDEA_ANSWER_INVALID`      | 400  | A value's shape does not match its `type` (e.g., string in NUMBER) |
| `IDEA_ANSWER_TOO_LONG`     | 400  | `SHORT_TEXT` > 120 or `LONG_TEXT` > 2 000 |
| `IDEA_ANSWER_OUT_OF_RANGE` | 400  | `NUMBER` outside `[min, max]` |
| `IDEA_ANSWER_OPTION_INVALID` | 400 | `SINGLE_CHOICE` value not in `options[].value` |

`details: { field: "<key>" }` is set on each.

---

## Relationship to existing entities

```
Category (Phase 1, unchanged columns + new JSON column)
├── id, name, state, …                ─ Phase 1
└── field_schema  ◄────────── CategoryFieldDefinition[]  (Phase 2)

Idea (Phase 1, unchanged columns + new JSON column)
├── id, authorId, categoryId, title, description, status, …  ─ Phase 1
└── category_answers  ◄────── IdeaStructuredAnswer[]    (Phase 2)
```

There is **no foreign key** from `IdeaStructuredAnswer.key` to a
field row, because fields are not rows. Referential integrity is
maintained by the application: on `idea` write the answers are
validated against the live schema; on `idea` read the answers are
displayed using their own `labelSnapshot` and the live schema is
consulted only to determine order.

---

## Read paths (cardinality)

| Page / route                                | Loads                                              | Notes |
|---------------------------------------------|----------------------------------------------------|-------|
| `GET /ideas/new`                            | `Category.field_schema` of every `ACTIVE` category | One small JSON per category; rendered once. |
| `POST /api/ideas` (create)                  | `Category.field_schema` of the chosen category      | Validates answers against the live schema. |
| `GET /ideas/[id]` (detail)                  | `Idea.category_answers` + `Category.field_schema` of that idea's category | Schema only consulted for ordering of still-present fields; orphans rendered from snapshot. |
| `GET /admin/categories/[id]/schema` (editor)| `Category.field_schema`                             | Admin only. |
| `PUT /api/categories/[id]/schema`           | Body → validate → write                             | Admin only. |

---

## Migration & seed plan

1. **Schema migration**: `drizzle/0001_smart_forms.sql` (above).
2. **Seed update**: the existing `src/db/seed.ts` seeds the five
   Phase-1 categories with an empty `field_schema`. Phase 2 ships
   an **opinionated initial schema** for each of the five seeded
   `ACTIVE` categories. The exact content is a content decision
   for implementation (per spec Assumptions); see
   [./quickstart.md "Seed expectations"](./quickstart.md#seed-expectations)
   for the per-category outline used by the tests.

---

## Out of scope (carries to later phases)

- Multi-select fields (deferred).
- File-type fields (Phase 3 multi-attachment supersedes).
- Date fields (deferred — locale/timezone scope is too large for
  ~30 min).
- Scoring weights / rubric per field (Phase 7 Scoring System).
- Per-field per-role visibility (no spec requirement; reviewers
  see everything employees submitted).
