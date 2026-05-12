---
description: "Tasks for Smart Submission Forms (Phase 2)"
---

# Tasks: Smart Submission Forms

**Input**: Design documents from `/specs/002-smart-forms/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md)

**Tests**: Required by Constitution V (Testing Pyramid + 70% line coverage on business logic). Every user story has unit + integration test tasks; Story 1 also has an E2E + axe task.

**Organization**: Tasks are grouped by user story. Each story is independently testable and yields a working slice.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Different files, no incomplete-task dependency → safe to run in parallel.
- **[Story]**: `[US1]`, `[US2]`, `[US3]` — maps to spec User Stories.
- Paths are repo-relative (rooted at `project/`).

## Path Conventions

Single Next.js project per [plan.md "Project Structure"](./plan.md#project-structure):

- Source: `src/` (Next.js App Router with API route handlers and server actions).
- Tests: `tests/unit/`, `tests/integration/`, `tests/e2e/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Bring the Phase 2 feature branch up to a working baseline.

- [ ] T001 Confirm working tree on branch `002-smart-forms` is clean (no untracked changes other than `specs/002-smart-forms/`); `cd project && git status`
- [ ] T002 [P] Verify Phase 1 still green on this branch: run `npm run typecheck` and `npm run lint` in `project/` and resolve any drift from `main`
- [ ] T003 [P] Verify Phase 1 tests still green on this branch: run `npm test` in `project/` and capture coverage as a baseline (no thresholds may regress)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Storage, validation primitives, and error vocabulary that every user story below depends on.

**⚠️ CRITICAL**: No user-story work begins until this phase is complete.

- [ ] T004 Add Phase 2 error codes to the registry in `project/src/lib/errors/codes.ts` — append `CATEGORY_SCHEMA_INVALID` (400), `CATEGORY_SCHEMA_FIELD_DUPLICATE` (400), `CATEGORY_SCHEMA_OPTION_REQUIRED` (400), `CATEGORY_NOT_ACTIVE` (409), `IDEA_ANSWER_REQUIRED` (400), `IDEA_ANSWER_INVALID` (400), `IDEA_ANSWER_TOO_LONG` (400), `IDEA_ANSWER_OUT_OF_RANGE` (400), `IDEA_ANSWER_OPTION_INVALID` (400)
- [ ] T005 [P] Add UI copy for the nine new codes in `project/src/lib/errors/error-messages.ts` (sentence case, plain language per Constitution VII.1)
- [ ] T006 Add the Phase 2 columns to the Drizzle schema in `project/src/db/schema.ts` — `categories.fieldSchema` (`text("field_schema").notNull().default("[]")`) and `ideas.categoryAnswers` (`text("category_answers").notNull().default("[]")`)
- [ ] T007 Generate the migration with `npx drizzle-kit generate` in `project/` and rename the output to `project/drizzle/0001_smart_forms.sql`; verify it contains exactly the two `ALTER TABLE … ADD COLUMN … DEFAULT '[]'` statements per [data-model.md "Schema delta"](./data-model.md#schema-delta-drizzle0001_smart_formssql)
- [ ] T008 [P] Author the Zod meta-schema and dynamic builder in `project/src/lib/validation/category-fields.ts` — export `CategoryFieldSchema` (Zod) typed `CategoryFieldDefinition[]` discriminated by `type` per [data-model.md "Entity: CategoryFieldDefinition"](./data-model.md#entity-value-object-categoryfielddefinition); export `IdeaCategoryAnswersList` (Zod) for at-rest parsing of the `ideas.category_answers` JSON column; export `buildAnswersZodSchema(fields)` per [ADR-0011](./adr/0011-dynamic-zod-validation.md)
- [ ] T009 [P] Author the answer-list validator + label-snapshot helpers in `project/src/server/category-answers.ts` — export `validateAnswers(fields, input, deps)` returning `IdeaStructuredAnswer[]` (each answer carries `labelSnapshot` copied from `fields[i].label`; for `SINGLE_CHOICE` fields also carries `valueLabelSnapshot` copied from the matching `option.label` per [data-model.md "Entity: IdeaStructuredAnswer"](./data-model.md#entity-value-object-ideastructuredanswer) and FR-008), throwing typed `AppError(IDEA_ANSWER_*)` with `details.field = "answers.<key>"`
- [ ] T010 [P] Extend the idea Zod request validator in `project/src/lib/validation/idea.ts` — add `answers: z.record(z.union([z.string(), z.number(), z.boolean()])).optional()` to `CreateIdeaInput` per [contracts/openapi.yaml "CreateIdeaRequest"](./contracts/openapi.yaml)
- [ ] T011 Extend the category repository in `project/src/db/repositories/category-repo.ts` — add `readSchema(id): Promise<CategoryFieldDefinition[]>` and `writeSchema(id, fields)` that parse/serialise via `CategoryFieldSchema` from T008; never write a non-Zod-validated value
- [ ] T012 Extend the idea repository in `project/src/db/repositories/idea-repo.ts` — add `readAnswers(id): Promise<IdeaStructuredAnswer[]>` and persist `category_answers` on insert via the existing `insertIdea` path; both ends parse via the validators from T008/T009
- [ ] T013 [P] Add registry-coverage unit tests for the nine new error codes in `project/tests/unit/lib/errors/codes.smart-forms.test.ts` — one `it('should map <CODE> to <status>')` per code (Quality Gate #9)
- [ ] T014 Update the seed in `project/src/db/seed.ts` to write the opinionated per-category schemas from [quickstart.md "Seed expectations"](./quickstart.md#seed-expectations) onto the five protected `ACTIVE` categories (overwrites `field_schema` only; leaves user/idea rows untouched)

**Checkpoint**: Foundation ready — user-story work can now begin.

---

## Phase 3: User Story 1 — Employee fills category-specific fields while submitting (Priority: P1) 🎯 MVP

**Goal**: Selecting a category on the new-idea form reveals the category's additional fields; required-field violations are rejected per-field; on success the answers are persisted with `labelSnapshot` and shown on the confirmation page.

**Independent Test**: As an Employee, open `/ideas/new`, cycle the category selector across each seeded `ACTIVE` category, assert the visible fields match each category's seed schema, submit with required fields blank → per-field error; submit with all required fields → 201 and answers persisted.

### Tests for User Story 1 ⚠️ Write FIRST, ensure they FAIL before implementation

- [ ] T015 [P] [US1] Unit tests for the dynamic Zod builder in `project/tests/unit/lib/validation/category-fields.test.ts` — table-driven via `it.each`: accepts the five seeded fixtures; rejects 9 negative cases (duplicate `key`, empty `options`, inverted `min`/`max`, oversized `label`, invalid `key` pattern, missing `type`, unknown `type`, wrong `value` shape per type, exceeded `length`)
- [ ] T016 [P] [US1] Unit tests for `validateAnswers` in `project/tests/unit/server/category-answers.test.ts` — one `it('should reject when …')` per `IDEA_ANSWER_*` sub-case asserting `error.code` and `details.field` per [data-model.md "Error codes added"](./data-model.md#error-codes-added)
- [ ] T017 [P] [US1] Unit tests for the label-snapshot path in `project/tests/unit/server/idea-service.smart-forms.test.ts` — in-memory `CategoryRepo` + `IdeaRepo` fakes; asserts that an idea created with a schema whose label is later renamed still returns the **original** `labelSnapshot` on re-read
- [ ] T018 [P] [US1] Integration test in `project/tests/integration/ideas-create-with-answers.test.ts` — `POST /api/ideas` with a complete answers block returns 201, persisted row's `category_answers` JSON equals `validateAnswers` output; missing-required returns 400 `IDEA_ANSWER_REQUIRED` with `details.field = "answers.<key>"`; submitting against a `PROPOSED` category yields no answer validation and reuses Phase 1 `IDEA_CATEGORY_PENDING` semantics; **submitting against a category that became `REJECTED` mid-session returns the Phase 1 `IDEA_CATEGORY_INVALID` envelope and persists no idea** (spec Edge Case)
- [ ] T019 [US1] E2E + axe in `project/tests/e2e/employee-submit-smart-idea.spec.ts` — covers Acceptance Scenarios 1–4 of Story 1; uses `@axe-core/playwright` at the 360×640 mobile breakpoint on `/ideas/new`; expects zero serious/critical violations (Quality Gate #8)

### Implementation for User Story 1

- [ ] T020 [P] [US1] Build the dynamic field renderer at `project/src/components/forms/dynamic-field-renderer.tsx` — one shadcn primitive per `type` (`Input` / `Textarea` / `Input[type=number]` / `RadioGroup` / `Switch`); each renders a `<Label htmlFor>` and wires `aria-describedby` to a `<p id={…-error}>` when an error exists (Constitution VI.2)
- [ ] T021 [US1] Extend the client form in `project/src/components/forms/idea-form.tsx` — accept `categoriesWithSchema: Array<{ id; name; fieldSchema: CategoryFieldDefinition[] }>`; on `categoryChoice` change, intersect-preserve `answers[key]` per FR-004; rebuild the Zod resolver via `coreSchema.merge(z.object({ answers: buildAnswersZodSchema(currentSchema) }))`; render `DynamicFieldRenderer` per field below the category selector
- [ ] T022 [US1] Update the new-idea page server component at `project/src/app/(employee)/ideas/new/page.tsx` to load each `ACTIVE` category with its `fieldSchema` (single query via `category-repo.ts`) and pass them to `IdeaForm`
- [ ] T023 [US1] Update `IdeaService.create` in `project/src/server/idea-service.ts` — after the existing category checks, call `validateAnswers(category.fieldSchema, input.answers ?? {}, { now: clock.now })`, persist the resulting `IdeaStructuredAnswer[]` via the repo path from T012; on a `PROPOSED` category, skip answer validation entirely (matches FR-011 and existing Phase-1 behaviour); on a `REJECTED` category the existing Phase-1 guard already rejects with `IDEA_CATEGORY_INVALID` before answer validation runs (spec Edge Case)
- [ ] T024 [US1] Update `POST /api/ideas` route handler at `project/src/app/api/ideas/route.ts` to accept the optional `answers` block from T010 and pass it through to `IdeaService.create`; no envelope changes
- [ ] T025 [US1] Render the confirmation/answers section on the submitter's idea detail page at `project/src/app/(employee)/ideas/[id]/page.tsx` — display each stored answer via [`CategoryDetailsPanel`](#story-2-tasks) once that component lands in Story 2 (see T029); for now this page change is the loader wiring that fetches `answers` on the existing detail-page query

**Checkpoint**: Story 1 fully functional — employee can submit a smart idea end-to-end; tests above are green.

---

## Phase 4: User Story 2 — Reviewer sees structured answers on the idea detail page (Priority: P1)

**Goal**: Reviewer (and Admin) opening an idea sees a "Category details" section with each label and value in the schema's order; orphaned answers still render with their original `labelSnapshot`; pre-Phase-2 ideas (`category_answers = '[]'`) hide the section entirely.

**Independent Test**: Seed an idea with three answers; log in as Evaluator and as Admin; the detail page renders the three label/value pairs in the configured order; remove one field from the schema and confirm the answer still appears under its `labelSnapshot`.

### Tests for User Story 2 ⚠️ Write FIRST

- [ ] T026 [P] [US2] Integration test in `project/tests/integration/ideas-detail-answers.test.ts` — four scenarios: (a) idea with 3 answers, schema unchanged → ordered render in schema order; (b) one schema field removed → orphan answer still rendered at the end via `labelSnapshot`; (c) idea created with `'[]'` (pre-Phase-2 fixture) → section hidden; (d) a `SINGLE_CHOICE` answer whose underlying option is renamed/removed after submit → detail page still renders the original option text via `valueLabelSnapshot` (spec Edge Case + FR-008). Assert against the React Server Component output via `next-test-api-route-handler` + RTL `render`.

### Implementation for User Story 2

- [ ] T027 [P] [US2] Add the read-side ordering helper to `project/src/server/category-answers.ts` — `orderAnswersForDisplay(answers, fields): IdeaStructuredAnswer[]` returns schema-ordered known fields first, then orphans in their original array order
- [ ] T028 [P] [US2] Extend the idea detail loader in `project/src/server/idea-service.ts` — return `answers: IdeaStructuredAnswer[]` on `IdeaDetail` per [contracts/openapi.yaml "IdeaDetail"](./contracts/openapi.yaml); reuse `orderAnswersForDisplay` from T027
- [ ] T029 [US2] Build the read-only render component at `project/src/components/ideas/category-details-panel.tsx` — accepts `answers: IdeaStructuredAnswer[]` and `categoryName: string`; hidden entirely when `answers.length === 0`; section header uses the category's display name (e.g. *"Process Improvement"*) per spec Story 2 scenario 1; each answer renders `<dt>{labelSnapshot}</dt><dd>{formattedValue}</dd>`; **`SINGLE_CHOICE` answers render `valueLabelSnapshot` (not `value`)** so historical answers survive option renames/removals (FR-008); booleans render `Yes`/`No`; numbers via `formatNumber`; long-text preserves whitespace via `whitespace-pre-wrap`
- [ ] T030 [US2] Wire `CategoryDetailsPanel` into both detail surfaces: `project/src/app/(employee)/ideas/[id]/page.tsx` (already wired by T025 to fetch answers — now pass them in) and `project/src/app/(reviewer)/queue/page.tsx` does **not** render this; the reviewer detail-page route lives at the same `/ideas/[id]` and is already covered

**Checkpoint**: Stories 1 + 2 both work — submission round-trips through display.

---

## Phase 5: User Story 3 — Admin manages the field schema of a category (Priority: P2)

**Goal**: An Admin can open `/admin/categories/[id]/schema` for an `ACTIVE` category and add / rename / reorder / remove fields; the change is reflected on the next new-idea form load; non-Admin access is denied.

**Independent Test**: As Admin, add a required `SHORT_TEXT` field "Estimated effort" to *Tooling*; log out, log in as Employee, open `/ideas/new`, select *Tooling* → the new required field is visible; submit empty → 400 `IDEA_ANSWER_REQUIRED` with `details.field = "answers.estimated_effort"`.

### Tests for User Story 3 ⚠️ Write FIRST

- [ ] T031 [P] [US3] Unit tests for `CategoryService.saveSchema` in `project/tests/unit/server/category-schema.test.ts` — accepts a valid schema; rejects non-`ACTIVE` with `CATEGORY_NOT_ACTIVE`; idempotent re-save; **never mutates** `category_answers` of any existing idea (asserted via in-memory repo)
- [ ] T032 [P] [US3] Integration test in `project/tests/integration/category-schema-admin.test.ts` — `GET /api/categories/[id]/schema` returns 200 for any authenticated user; `PUT` returns 200 for Admin on `ACTIVE`, 403 `AUTH_FORBIDDEN_ROLE` for non-Admin, 409 `CATEGORY_NOT_ACTIVE` on non-`ACTIVE`, 400 `CATEGORY_SCHEMA_FIELD_DUPLICATE` / `CATEGORY_SCHEMA_OPTION_REQUIRED` for the documented invalid inputs

### Implementation for User Story 3

- [ ] T033 [P] [US3] Build `CategoryService.getSchema` / `saveSchema` in `project/src/server/category-service.ts` (extend the existing file) — `getSchema(id)` is a thin pass-through over `category-repo.readSchema`; `saveSchema(id, fields, actor)` requires Admin role (delegates to `requireRole("ADMIN")` from `role-guard.ts`), verifies state via `findCategoryById` and throws `AppError(CATEGORY_NOT_ACTIVE)` on non-`ACTIVE`, parses through `CategoryFieldSchema` (T008), then `category-repo.writeSchema`
- [ ] T034 [P] [US3] Add the schema utilities module `project/src/server/category-schema.ts` — pure helpers used by both the service and the editor UI: `validateSchema(input): CategoryFieldDefinition[]` (Zod `parse`), `diffSchemas(prev, next): { added: string[]; removed: string[]; renamed: Array<{ key: string; from: string; to: string }> }`
- [ ] T035 [US3] Build the API route at `project/src/app/api/categories/[id]/schema/route.ts` — `GET` returns the live schema; `PUT` requires the `withErrorHandler` wrapper, parses the body via `CategoryFieldSchema` (Zod), calls `CategoryService.saveSchema`, returns the saved schema as JSON; uses CSRF protection inherited from NextAuth
- [ ] T036 [P] [US3] Build the `SINGLE_CHOICE` options sub-editor at `project/src/components/admin/category-schema-options-editor.tsx` — list of `{ value; label }` rows with add / remove; inline validation that `value` matches the documented pattern and `options.length ≥ 1`
- [ ] T037 [P] [US3] Build the per-row field editor at `project/src/components/admin/category-schema-field-row.tsx` — fields for `key` (read-only after first save), `label`, `type` (`Select`), `required` (`Switch`), `helpText`, and (if `type === 'SINGLE_CHOICE'`) the options editor from T036; reorder via up/down buttons that mutate the parent's array
- [ ] T038 [US3] Build the schema editor page at `project/src/components/admin/category-schema-editor.tsx` (client component) and the server-component page at `project/src/app/(admin)/admin/categories/[id]/schema/page.tsx` — page loads the category + current schema via `requireRole("ADMIN")`, redirects with a toast when the category is not `ACTIVE`; editor uses React Hook Form + `zodResolver(CategoryFieldSchema)`; on submit `PUT`s to the route from T035; explicit loading / empty / error / success states (Constitution VI.3)
- [ ] T039 [US3] Add an "Edit schema" link on each `ACTIVE` row of the existing admin categories page at `project/src/app/(admin)/admin/categories/page.tsx` — disabled (and visually de-emphasised) for non-`ACTIVE` rows

**Checkpoint**: All three user stories work; an admin can drive the schema editor end-to-end at all three breakpoints.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Make the feature shippable per Constitution Quality Gates 1–12.

- [ ] T040 [P] Run the error-code consistency check `npm run check:error-codes` from `project/`; fix any drift (every code in `codes.ts` must be referenced and tested) — Quality Gate #9
- [ ] T041 [P] Run the UI-token check `npm run check:ui-tokens` from `project/`; ensure no hex / arbitrary Tailwind values / inline `style` props leaked into Phase 2 components — Quality Gate #9
- [ ] T042 [P] Run `npm run lint` and `npm run typecheck` in `project/`; zero warnings on protected branches (Quality Gates 1 + 2)
- [ ] T043 Run `npm test` + `npm run test:e2e` in `project/`; coverage on `src/server/**` and the business-logic subset of `src/lib/**` MUST stay ≥ 70% line (Quality Gate #4)
- [ ] T044 [P] Update `README.md` and (if present) `docs/quickstart.md` with the Phase 2 entry points and the new admin URL (`/admin/categories/[id]/schema`)
- [ ] T045 [P] Walk through every scenario in [./quickstart.md](./quickstart.md) on a fresh checkout (clean `data/innovatepam.db`); record screenshots for the demo deck (`content/`)
- [ ] T046 Final ADR sweep: verify [./adr/README.md](./adr/README.md) lists ADR-0009…0012 and every load-bearing choice in [./plan.md](./plan.md) cites an `ADR-NNNN` (Quality Gate #11)
- [ ] T047 Merge feature branch `002-smart-forms` to `main` with `git merge --no-ff` once Gates 1–11 are green; merge-commit subject: `merge(feature/002): smart-submission-forms`; body lists ADR-0009…0012 and links [./spec.md](./spec.md) (Quality Gate #12)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: depends on Setup. **Blocks every user story.**
- **User Story 1 (Phase 3)**: depends on Foundational (especially T006, T008, T009, T010, T011, T012). MVP.
- **User Story 2 (Phase 4)**: depends on Foundational + Story 1 (Story 2 reads what Story 1 writes; T025 is shared with T030).
- **User Story 3 (Phase 5)**: depends on Foundational only — can run in parallel with Story 2 by a separate contributor.
- **Polish (Phase 6)**: depends on every chosen user story being complete.

### Within each story

- Tests are authored first and made to **fail** before the implementation tasks land (Constitution V.1).
- Models / validators before services; services before route handlers; route handlers before page wiring.
- Each story is a complete, independently demoable slice.

### Parallel opportunities

- All Setup tasks marked `[P]` run together (T002, T003).
- In Foundational: T005, T008, T009, T010, T013 are `[P]` once T004 and T006 land.
- All "Tests for User Story N" tasks marked `[P]` can run as one batch per story.
- Stories 2 and 3 can be picked up by two contributors in parallel after Foundational.
- Polish tasks T040–T045 are mostly `[P]`; T046 and T047 are strictly sequential at the end.

---

## Parallel Example: User Story 1 tests

```text
# Run these four tasks together:
T015 [P] [US1] unit/lib/validation/category-fields.test.ts
T016 [P] [US1] unit/server/category-answers.test.ts
T017 [P] [US1] unit/server/idea-service.smart-forms.test.ts
T018 [P] [US1] integration/ideas-create-with-answers.test.ts
# Then sequentially:
T019 [US1] e2e/employee-submit-smart-idea.spec.ts
```

---

## Implementation Strategy

### MVP first (Stories 1 + 2)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — blocking.
3. Complete Phase 3 (Story 1 — Employee submits with answers).
4. Complete Phase 4 (Story 2 — Reviewer reads answers).
5. **STOP and VALIDATE**: Stories 1 + 2 are demoable end-to-end against the seeded schemas.
6. Demo with the seeded schemas only; defer Story 3 if time-boxed.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. + Story 1 → smart submission live (MVP).
3. + Story 2 → reviewers see structured answers (full P1 set).
4. + Story 3 → Admin self-service for schema edits.
5. + Polish → ship.

### Parallel team strategy

After Foundational lands:

- Developer A: Story 1 (Phase 3).
- Developer B: Story 2 (Phase 4) — picks up T026 / T027 / T029 as soon as T028's signature is agreed.
- Developer C: Story 3 (Phase 5) — fully independent of Stories 1 + 2.

---

## Notes

- `[P]` = different files, no incomplete-task dependency.
- `[Story]` ties each task to its user story for traceability against [spec.md](./spec.md).
- Tests are authored first and must fail before implementation (Constitution V.1).
- Commit after each task (Conventional Commits); the `post-commit` push hook auto-pushes to `origin/002-smart-forms` (Constitution VIII).
- Stop at any **Checkpoint** to validate each story in isolation.
- Avoid: cross-story file conflicts on `idea-form.tsx` (Story 1 owns it), on `category-service.ts` (Story 3 owns the schema methods but Story 1 owns the call site).
