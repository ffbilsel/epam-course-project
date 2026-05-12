# Quickstart — Smart Submission Forms (Phase 2)

Local recipes to install, migrate, seed, run, and test the Phase 2
work on top of an already-bootstrapped Phase 1 checkout.

> **Pre-requisite**: Phase 1 (`001-innovatepam-portal-mvp`) is
> merged into `main` and the local working tree builds green
> (`npm run check` passes from the `project/` directory). Phase 2
> work happens on branch `002-smart-forms`.

## 1. Apply the schema delta

```powershell
# from repo root
cd project
npm run db:generate         # regenerates drizzle SQL from src/db/schema.ts
npm run db:migrate          # applies drizzle/0001_smart_forms.sql to data/innovatepam.db
```

After migration, the two new columns exist with the safe defaults:

```sql
sqlite> PRAGMA table_info(categories);
…|field_schema|TEXT|1|'[]'|0
sqlite> PRAGMA table_info(ideas);
…|category_answers|TEXT|1|'[]'|0
```

## 2. Seed the opinionated initial schemas

`src/db/seed.ts` is extended in Phase 2 so that each of the five
seeded `ACTIVE` categories ships with a small, opinionated schema
(see [data-model.md](./data-model.md) and the per-category outline
below). Re-run the seed once:

```powershell
npm run db:seed
```

Existing user/idea rows are untouched; only `categories.field_schema`
is overwritten for the five protected categories.

### Seed expectations

| Category               | Fields (key → type, required) |
|------------------------|--------------------------------|
| Process Improvement    | `current_process` (LONG_TEXT, ✔) · `pain_point` (LONG_TEXT, ✔) · `estimated_hours_saved_per_week` (NUMBER 0..168, ✔) · `customer_facing` (YES_NO) |
| Product Innovation     | `target_users` (SHORT_TEXT, ✔) · `differentiator` (LONG_TEXT, ✔) · `audience` (SINGLE_CHOICE: engineering/delivery/everyone) |
| Tooling                | `tool_name` (SHORT_TEXT, ✔) · `replaces_what` (LONG_TEXT) · `estimated_setup_hours` (NUMBER 0..40) |
| Customer Experience    | `customer_segment` (SHORT_TEXT, ✔) · `current_pain` (LONG_TEXT, ✔) · `expected_impact` (LONG_TEXT, ✔) |
| Other                  | _(empty schema — Phase-1 behaviour)_ |

The exact list is asserted by `tests/integration/_setup.ts`
fixtures so test code and seed content cannot drift.

## 3. Run the app

```powershell
npm run dev     # http://localhost:3000
```

Sign in as the bootstrap admin (`BOOTSTRAP_ADMIN_EMAIL` from your
`.env.local`) to reach `/admin/categories` and the new
`/admin/categories/[id]/schema` editor; sign in as a regular
Employee to see the dynamic new-idea form at `/ideas/new`.

## 4. Test recipes

### Unit (Vitest, `tests/unit/**`)

```powershell
npm run test:unit
```

New unit suites added by Phase 2:

| Suite                                                 | Asserts                                                                |
|-------------------------------------------------------|------------------------------------------------------------------------|
| `lib/validation/category-fields.test.ts`              | meta-schema accepts the five seeded fixtures; rejects 9 negative cases (duplicate key, empty options, inverted min/max, oversized label, invalid key, etc.) |
| `server/category-schema.test.ts`                      | `saveSchema` returns `409 CATEGORY_NOT_ACTIVE` for non-ACTIVE; idempotent re-save; never mutates `category_answers` of any existing idea |
| `server/category-answers.test.ts`                     | `validateAnswers` flags every `IDEA_ANSWER_*` sub-case with the correct `details.field` |
| `server/idea-service.smart-forms.test.ts`             | `createIdea` snapshots `labelSnapshot` even when the underlying field is renamed between save and re-read |

### Integration (Vitest with real SQLite + route handlers)

```powershell
npm run test:integration
```

New integration suites:

| Suite                                          | Endpoint(s)                                  | Story |
|------------------------------------------------|----------------------------------------------|-------|
| `tests/integration/category-schema-admin.test.ts` | `GET/PUT /api/categories/[id]/schema`        | 3     |
| `tests/integration/ideas-create-with-answers.test.ts` | `POST /api/ideas` with `answers` block      | 1     |
| `tests/integration/ideas-detail-answers.test.ts` | `GET /api/ideas/[id]` returns answers with snapshot | 2 |

### E2E (Playwright + axe)

```powershell
npm run test:e2e
```

New journey: `tests/e2e/employee-submit-smart-idea.spec.ts`. It
covers Acceptance Scenarios 1–4 of Story 1 plus an axe sweep of
the new-idea page at the 360 × 640 mobile breakpoint.

### Pre-merge check

```powershell
npm run check    # typecheck + lint + unit + integration + e2e + coverage
```

Coverage thresholds (Constitution V.2) remain at 70% line on
`src/server/**` and the business-logic subset of `src/lib/**`.

## 5. Constitution gates touch-points

| Gate | Where it bites in Phase 2 |
|------|---------------------------|
| #1 typecheck | discriminated union of `CategoryFieldDefinition` keeps `noFallthroughCasesInSwitch` honest. |
| #4 coverage  | new modules `category-schema.ts`, `category-answers.ts`, `category-fields.ts` are in scope. |
| #8 a11y      | `@axe-core/playwright` sweep on the new-idea page (Story 1) and schema editor (Story 3). |
| #9 consistency | 8 new error codes wired into `src/lib/errors/codes.ts` + `error-messages.ts` + one test per code. |
| #11 ADRs     | ADR-0009…0012 (`./adr/`) cover every load-bearing choice. |
| #12 merge    | last task in [`./tasks.md`](./tasks.md) is `git merge --no-ff` to `main`. |

## 6. Rolling back

The migration is reversible by dropping the two columns; in
practice SQLite + Drizzle's drop-add cycle is heavy, so the safer
roll-back is to ship a no-op patch that:

1. ignores `answers` on `POST /api/ideas`,
2. hides the "Category details" section on the detail page,
3. removes the admin schema-editor link.

The columns then become inert and may be dropped on the next
data-migration window.
