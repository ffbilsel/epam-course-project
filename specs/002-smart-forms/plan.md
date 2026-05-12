# Implementation Plan: Smart Submission Forms (Phase 2)

**Branch**: `002-smart-forms` | **Date**: 2026-05-12 |
**Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from
`/specs/002-smart-forms/spec.md`

## Summary

Extend the Phase 1 idea-submission flow so that every **Category**
carries an ordered, typed **field schema** (zero or more additional
questions), the new-idea form **adapts at runtime** to render those
fields when a category is selected, and the captured **structured
answers** travel with the idea and surface on the reviewer's detail
page. Admins manage each `ACTIVE` category's schema from the
existing admin category surface.

The feature is **purely additive to Phase 1**: the idea state
machine, attachment rules, role guards, audit log, and error
envelope are untouched. Two new persistence columns are added
(`categories.field_schema` and `ideas.category_answers`), both
storing JSON validated by Zod at every read/write boundary; no new
tables are introduced. The shared validator (Zod) is used to
**dynamically build** a per-category schema at submission time so
that the same constraint description drives both the React Hook
Form on the client and the server-side `safeParse` (Constitution
VII).

## Technical Context

**Language/Version**: TypeScript ~5.4 (strict mode unchanged from
Phase 1); Node.js `>=20 <21`.
**Primary Dependencies**: unchanged from Phase 1 — Next.js 14 (App
Router), React 18, Tailwind CSS, shadcn/ui, Zod, React Hook Form +
`@hookform/resolvers/zod`, NextAuth v5 + Drizzle adapter, Drizzle
ORM + `better-sqlite3`, `date-fns`, `lucide-react`,
`class-variance-authority`, `sonner`. **No new runtime
dependencies**; the dynamic Zod schema is built from primitives
already in `zod`.
**Storage**: SQLite via `better-sqlite3`. **Schema delta** (Drizzle
migration `drizzle/0001_smart_forms.sql`):
1. `ALTER TABLE categories ADD COLUMN field_schema TEXT NOT NULL DEFAULT '[]'`
   — JSON-encoded `CategoryFieldDefinition[]`.
2. `ALTER TABLE ideas ADD COLUMN category_answers TEXT NOT NULL DEFAULT '[]'`
   — JSON-encoded `StructuredAnswer[]` (with label snapshot per
   FR-008).
3. No new indexes (the JSON columns are loaded by row id, never
   queried by predicate).
**Testing**: Vitest 1.6 (`unit` + `integration` projects), RTL 16,
Playwright 1.45 with `@axe-core/playwright`. Coverage thresholds
unchanged.
**Target Platform**: identical to Phase 1 (Chromium/Firefox/Safari
on desktop/tablet/mobile ≥ 360 px).
**Project Type**: Full-stack web app (Next.js).
**Performance Goals**: schema-driven form renders within **200 ms**
of category change on a mid-tier laptop (SC-002); validation +
persistence latency stays within the Phase 1 budget (<100 ms per
idea write).
**Constraints**: no external services, no UI-library additions,
no new file-system layout, no scoring/analytics (deferred to Phase
7). Schema size capped at **20 fields × 1 KiB label/options per
category** to bound the JSON-column footprint.
**Scale/Scope**: ≤ 1 000 active users, ≤ 10 000 ideas, ≤ 8 fields
per category in normal usage. 12 functional requirements
(FR-001…FR-012), 3 user stories, 2 new entities
(`CategoryFieldDefinition`, `IdeaStructuredAnswer`), 1 schema-
management UI surface, 2 new API routes, ~6 React components, 4
ADRs.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at **v1.4.0** has **10 principles** and **12
quality gates**. Each is evaluated below for this plan; **no
violations require justification**.

### Principle compliance

| Principle | Compliance |
|---|---|
| **I. Clean Code** | New modules (`category-schema.ts`, `category-answers.ts`, `dynamic-field-renderer.tsx`) are single-purpose; the dynamic Zod builder is a pure function ≤ 30 LOC. No dead code; no TODOs. |
| **II. TypeScript Strict** | `CategoryFieldDefinition` is a discriminated union by `type`; Zod schemas drive both runtime parsing and inferred types. No `any`, no `!`, no `@ts-ignore`. JSON columns are parsed with `safeParse` at every load. |
| **III. Testing Pyramid 70%** | New business logic in `src/server/category-service.ts` (schema CRUD) and `src/server/idea-service.ts` (answers validation) is covered by unit tests with in-memory repository fakes; integration tests exercise the new routes end-to-end. Threshold unchanged. |
| **IV. JSDoc** | Every exported type, function, and component prop gets a JSDoc block (summary + `@param` + `@returns` + `@throws` where applicable). |
| **V. Testing Principles** | AAA layout; `beforeEach` isolation; one assertion of behaviour per `it`; in-memory fakes for `CategoryRepo` and `IdeaRepo` in the unit tier. The dynamic-Zod builder is tested with table-driven `it.each` to keep duplication out. |
| **VI. UX (responsive, a11y, polish)** | Schema-driven fields use shadcn primitives (`Input`, `Textarea`, `RadioGroup`, `Switch`, `Label`); all four screen states (loading/empty/error/success) preserved; mobile-first; every dynamic field has a programmatic `<label htmlFor>` and `aria-describedby` for inline errors; `@axe-core/playwright` runs against the new admin schema editor. |
| **VII. Consistency (UI, code, error codes)** | New error codes added to the single registry (`src/lib/errors/codes.ts`): `CATEGORY_SCHEMA_INVALID`, `CATEGORY_SCHEMA_FIELD_DUPLICATE`, `CATEGORY_SCHEMA_OPTION_REQUIRED`, `CATEGORY_NOT_ACTIVE`, `IDEA_ANSWER_REQUIRED`, `IDEA_ANSWER_INVALID`, `IDEA_ANSWER_TOO_LONG`, `IDEA_ANSWER_OUT_OF_RANGE`, `IDEA_ANSWER_OPTION_INVALID`. UI strings live in `error-messages.ts`. No hex/arbitrary Tailwind values. |
| **VIII. Commit & Push Discipline** | SpecKit `auto_commit` hooks (`.specify/extensions.yml`) plus the `post-commit` push hook (already installed in Phase 1) continue to drive Conventional Commits + immediate `git push` per lifecycle step and per task. |
| **IX. ADR-Backed Design Choices** | Every load-bearing choice has a MADR ADR under [./adr/](./adr/): schema storage strategy (ADR-0009), answer storage with label snapshot (ADR-0010), dynamic Zod validation (ADR-0011), and field-type taxonomy & extensibility (ADR-0012). |
| **X. Feature Merge Discipline** | Feature branch `002-smart-forms` merges to `main` exclusively via `git merge --no-ff` once Quality Gates 1–11 pass. Encoded as the final task in `tasks.md`. |

### Quality gates

| # | Gate | How this plan satisfies it |
|---|---|---|
| 1 | `tsc --noEmit` strict | unchanged; `npm run typecheck` in CI. |
| 2 | ESLint + Prettier zero errors | unchanged toolchain. |
| 3 | Unit + integration + E2E pass | new tests in each tier (see [./quickstart.md](./quickstart.md)). |
| 4 | ≥ 70% line on business logic | new modules `category-schema.ts`, `category-answers.ts`, and `category-fields.ts` covered ≥ 70%. |
| 5 | JSDoc on exports | `eslint-plugin-jsdoc` enforces. |
| 6 | Code review / Constitution note | solo course project — self-review with rationale per PR. |
| 7 | Constitution Check | this section. |
| 8 | A11y/responsiveness | jsx-a11y + axe; manual checklist for the schema editor (P2) at all three breakpoints. |
| 9 | Consistency | new codes added to the registry with one-test-per-code; the error envelope is reused unchanged. |
| 10 | Commit & push discipline | inherited automation. |
| 11 | ADR coverage | ADR-0009…0012 cover every new design choice; ADR index `specs/002-smart-forms/adr/README.md` lists them. |
| 12 | Feature merge-back | final task performs `git merge --no-ff` to `main`. |

### Excluded coverage paths (documented per V.2)

Unchanged from Phase 1: `src/app/**`, `src/components/ui/**`,
`src/lib/errors/codes.ts`, `src/db/migrations/**`, `src/db/seed.ts`.
The dynamic Zod builder lives in
`src/lib/validation/category-fields.ts` and **is** in scope for the
70% floor.

**Result**: PASS. Re-check after Phase 1 design — no expected drift.

## Project Structure

### Documentation (this feature)

```text
specs/002-smart-forms/
├── plan.md              # This file
├── spec.md              # Authoritative spec
├── research.md          # Phase 0 — decisions & alternatives
├── data-model.md        # Phase 1 — new entities + JSON shapes
├── quickstart.md        # Phase 1 — run/test/migrate locally
├── adr/
│   ├── README.md
│   ├── 0009-category-schema-storage.md
│   ├── 0010-answer-storage-and-label-snapshot.md
│   ├── 0011-dynamic-zod-validation.md
│   └── 0012-field-type-taxonomy.md
├── contracts/
│   └── openapi.yaml     # Phase 1 — REST delta for category schema + idea answers
├── checklists/
│   └── requirements.md  # Already authored by /speckit.specify
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root) — additions only

```text
project/
├── drizzle/
│   └── 0001_smart_forms.sql                       # NEW migration
├── src/
│   ├── app/
│   │   ├── (admin)/admin/categories/[id]/schema/
│   │   │   └── page.tsx                           # NEW — schema editor (Story 3)
│   │   ├── (employee)/ideas/new/page.tsx          # CHANGED — pass field schema
│   │   ├── (employee)/ideas/[id]/page.tsx         # CHANGED — render answers section
│   │   └── api/
│   │       ├── categories/[id]/schema/route.ts    # NEW — GET schema, PUT schema (admin)
│   │       └── ideas/route.ts                     # CHANGED — validate answers
│   ├── components/
│   │   ├── forms/
│   │   │   ├── idea-form.tsx                      # CHANGED — render dynamic fields
│   │   │   └── dynamic-field-renderer.tsx         # NEW — one field → one shadcn primitive
│   │   ├── admin/
│   │   │   ├── category-schema-editor.tsx         # NEW — Story 3 UI
│   │   │   ├── category-schema-field-row.tsx      # NEW — single field row
│   │   │   └── category-schema-options-editor.tsx # NEW — for SINGLE_CHOICE options
│   │   └── ideas/
│   │       └── category-details-panel.tsx         # NEW — Story 2 read-only render
│   ├── server/
│   │   ├── category-service.ts                    # CHANGED — getSchema / saveSchema
│   │   ├── category-schema.ts                     # NEW — schema validation + diff utilities
│   │   ├── idea-service.ts                        # CHANGED — validate answers on create
│   │   └── category-answers.ts                    # NEW — validate-answers + label-snapshot
│   ├── db/
│   │   ├── schema.ts                              # CHANGED — add 2 columns
│   │   └── repositories/
│   │       ├── category-repo.ts                   # CHANGED — readSchema / writeSchema
│   │       └── idea-repo.ts                       # CHANGED — readAnswers / writeAnswers
│   ├── lib/
│   │   ├── validation/
│   │   │   ├── category-fields.ts                 # NEW — Zod meta-schema + dynamic builder
│   │   │   └── idea.ts                            # CHANGED — accept `answers` block
│   │   └── errors/
│   │       ├── codes.ts                           # CHANGED — add 9 new codes
│   │       └── error-messages.ts                  # CHANGED — UI copy for new codes
│   └── types/index.ts                             # CHANGED — re-export field types
├── tests/
│   ├── unit/
│   │   ├── lib/validation/category-fields.test.ts          # NEW
│   │   ├── server/category-schema.test.ts                  # NEW
│   │   ├── server/category-answers.test.ts                 # NEW
│   │   └── server/idea-service.smart-forms.test.ts         # NEW
│   ├── integration/
│   │   ├── category-schema-admin.test.ts                   # NEW (Story 3)
│   │   ├── ideas-create-with-answers.test.ts               # NEW (Story 1)
│   │   └── ideas-detail-answers.test.ts                    # NEW (Story 2)
│   └── e2e/
│       └── employee-submit-smart-idea.spec.ts              # NEW (Story 1, axe-checked)
```

**Structure Decision**: Inherit the Phase 1 single-Next.js-project
layout; no new top-level folders. The dynamic-field UI lives next
to the existing `idea-form.tsx` (`src/components/forms/`); the
admin schema editor lives next to existing admin components
(`src/components/admin/`). All business logic stays in
`src/server/`; persistence remains a thin repository over Drizzle.

## Complexity Tracking

> No Constitution Check violations. Section intentionally empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_  | _(n/a)_    | _(n/a)_                              |
