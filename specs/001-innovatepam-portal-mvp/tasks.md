# Tasks: InnovatEPAM Portal MVP

**Input**: Design documents from [`/specs/001-innovatepam-portal-mvp/`](.)
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/openapi.yaml](./contracts/openapi.yaml), [quickstart.md](./quickstart.md), [adr/](./adr/)

**Tests**: Tests are included throughout. Constitution Principle III mandates **≥ 70 % business-logic line coverage** on `src/server/**` and the business-logic subset of `src/lib/**`. Constitution Principle V recommends TDD; tasks marked "Tests for …" SHOULD be written first and observed failing before the matching implementation tasks land.

**Organization**: Tasks are grouped by user story (US1–US4 from spec.md) so each story can be implemented, tested, and merged independently.

## Format

```
- [ ] [TaskID] [P?] [Story?] Description with file path(s)
```

- **[P]** — parallelisable (different files, no dependencies on incomplete tasks).
- **[US#]** — required for tasks inside a User Story phase.
- **File paths** are relative to repo root (`./project/` is repo root in this workspace; tasks below treat that as `.`).

## Path conventions

Per [plan.md → Source Code (repository root)](./plan.md):

- App + API: `src/app/**`
- Domain logic: `src/server/**`, `src/db/**`, `src/lib/**`
- UI primitives: `src/components/ui/**`; feature components: `src/components/**`
- Tests: `tests/{unit,integration,e2e}/**` (colocated unit tests permitted under `src/**/__tests__/`)
- Migrations: `./drizzle/`; runtime data: `./data/` (gitignored)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the Next.js project skeleton, install pinned dependencies, and wire the toolchain that every later task depends on.

- [ ] T001 Create the Next.js skeleton at repo root: `package.json`, `tsconfig.json`, `next.config.mjs`, `.editorconfig`, `.nvmrc` (Node 20), `.env.example` (`NEXTAUTH_SECRET`, `BOOTSTRAP_ADMIN_EMAIL`, `DATABASE_URL=file:./data/innovatepam.db`), `src/app/layout.tsx`, `src/app/page.tsx` placeholders. Folder layout per [plan.md](./plan.md).
- [ ] T002 Install runtime dependencies via `npm install`: `next@^14`, `react`, `react-dom`, `next-auth@beta`, `@auth/drizzle-adapter`, `argon2`, `drizzle-orm`, `better-sqlite3`, `zod`, `react-hook-form`, `@hookform/resolvers`, `sonner`, `lucide-react`, `class-variance-authority`, `tailwind-merge`, `clsx`, `date-fns`, `file-type`, `@upstash/ratelimit`. Pin versions per [plan.md Technical Context](./plan.md).
- [ ] T003 Install dev dependencies: `typescript@~5.4`, `@types/{node,react,react-dom,better-sqlite3}`, `drizzle-kit`, `vitest@^1.6`, `@testing-library/{react,jest-dom,user-event}`, `@vitejs/plugin-react`, `jsdom`, `@playwright/test@^1.45`, `@axe-core/playwright`, `eslint`, `eslint-config-next`, `eslint-plugin-jsx-a11y`, `eslint-plugin-jsdoc`, `prettier`, `prettier-plugin-tailwindcss`, `tsx`.
- [ ] T004 [P] Configure `tsconfig.json` strict mode per Constitution II: `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noImplicitReturns`, `forceConsistentCasingInFileNames`. Path alias `@/*` → `src/*`.
- [ ] T005 [P] Configure ESLint at `.eslintrc.cjs`: extend `next/core-web-vitals`, `plugin:jsx-a11y/recommended`, `plugin:jsdoc/recommended-typescript-error`. Add rules: `no-restricted-imports` to forbid `next/legacy`, `complexity` ≤ 10, `max-lines-per-function` ≤ 80 (Principle I).
- [ ] T006 [P] Configure Prettier at `.prettierrc.json` with `prettier-plugin-tailwindcss`; `.prettierignore` excludes `data/`, `drizzle/`, `coverage/`, `.next/`.
- [ ] T007 [P] Initialise Tailwind: `tailwind.config.ts` with design tokens (color scale, spacing, typography, focus-ring), `postcss.config.cjs`, `src/app/globals.css`. Tokens per [ADR-0007](./adr/0007-ui-and-design-system.md).
- [ ] T008 [P] Vendor shadcn/ui primitives under `src/components/ui/`: `button.tsx`, `input.tsx`, `label.tsx`, `card.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `form.tsx`, `select.tsx`, `textarea.tsx`, `table.tsx`, `badge.tsx`, `toaster.tsx`, plus `cn()` helper at `src/lib/utils.ts`.
- [ ] T009 [P] Add npm scripts to `package.json`: `dev`, `build`, `start`, `typecheck`, `lint`, `format`, `format:write`, `test`, `test:unit`, `test:integration`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, `db:reset`, `check:error-codes`, `check:ui-tokens`, `check` (= typecheck + lint + format + test:unit), `setup:hooks` (`pwsh -File scripts/install-hooks.ps1`).
- [ ] T010 [P] Configure Vitest at `vitest.config.ts` with two projects (`unit`, `integration`), `jsdom` env for unit, `node` for integration, `coverage` provider `v8`, thresholds 70 % lines on `src/server/**` and the business-logic subset of `src/lib/**`. Excluded coverage paths per [plan.md](./plan.md).
- [ ] T011 [P] Configure Playwright at `playwright.config.ts` with three projects (chromium, firefox, webkit), `@axe-core/playwright` helper at `tests/e2e/axe.ts`, base URL `http://localhost:3000`.
- [ ] T012 [P] Pre-commit safety: run `npm run setup:hooks` once locally to point `core.hooksPath` at `.githooks` (already shipped); verify post-commit + post-merge auto-push fire (Constitution VIII / X).

---

## Phase 2: Foundational (Blocking prerequisites)

**Purpose**: Ship the database, auth wiring, error contract, and shared infrastructure that **every** user story needs.

**⚠️ CRITICAL**: No US task may start until this phase is complete.

- [ ] T013 Drizzle schema at `src/db/schema.ts`: tables `users`, `accounts`/`sessions`/`verification_tokens` (NextAuth adapter), `categories`, `ideas`, `attachments`, `status_transitions` with all enums, CHECK constraints, FKs (RESTRICT default; CASCADE only on `attachments.idea_id`), unique-on-`lower()` indexes per [data-model.md](./data-model.md).
- [ ] T014 Drizzle config at `drizzle.config.ts` pointing at `./data/innovatepam.db`, output dir `./drizzle/`, dialect `sqlite`, schema `src/db/schema.ts`.
- [ ] T015 Generate the initial migration: `npm run db:generate -- --name init`; review and commit `./drizzle/0000_*.sql` + `meta/` snapshot.
- [ ] T016 [P] DB connection helper at `src/db/client.ts`: opens `better-sqlite3`, sets `PRAGMA foreign_keys = ON`, `PRAGMA journal_mode = WAL`, exports a singleton `db` and a `withTx(fn)` helper.
- [ ] T017 [P] Seed script at `src/db/seed.ts`: inserts the 5 categories (`Process Improvement`, `Product Innovation`, `Tooling`, `Customer Experience`, `Other` with `is_protected = 1`); idempotent via `INSERT … ON CONFLICT DO NOTHING`.
- [ ] T018 [P] Error-code registry at `src/lib/errors/codes.ts`: `as const` object listing all 26 codes from [data-model.md "Error-code surface"](./data-model.md) with `httpStatus` for each.
- [ ] T019 [P] `src/lib/errors/AppError.ts`: `class AppError extends Error` with `code`, `httpStatus`, `details`; static helpers `AppError.notFound(code)`, `AppError.conflict(code, details?)`.
- [ ] T020 [P] `src/lib/errors/error-messages.ts`: code → human-readable English message catalogue (UI never hard-codes strings — Principle VII).
- [ ] T021 [P] `src/lib/errors/with-error-handler.ts`: HOC for Route Handlers that catches `AppError` and `ZodError`, renders `{ error: { code, message, details } }`, defaults unknown → `INTERNAL_ERROR` (500) with stack only logged server-side.
- [ ] T022 [P] CI guard `scripts/check-error-codes.ts` (Quality Gate #9): scans `src/**` for `ERROR_CODES.*` references, fails on any code referenced but undeclared, any declared but unused **and** untested. Wire as `npm run check:error-codes`.
- [ ] T023 [P] CI guard `scripts/check-ui-tokens.ts` (Quality Gate #9): regex-scans `src/app/**` and `src/components/**` (excluding `src/components/ui/**`) for hex colours, arbitrary Tailwind values like `p-[13px]`, and inline `style=` props. Wire as `npm run check:ui-tokens`.
- [ ] T024 [P] `src/lib/format/date.ts`: `formatDate(d: Date)`, `formatDateTime(d: Date)` using `date-fns` + `navigator.language` (server fallback `en-US`) per [research.md R-011](./research.md).
- [ ] T025 NextAuth options at `src/server/auth-options.ts`: Credentials provider, `@auth/drizzle-adapter` over `db`, `strategy: "database"`, `session.maxAge = 24 * 60 * 60`, `session` callback that bumps `expires` to `now + 24h` on every call, `authorize()` calling `password.verifyPassword()`. Bind types in `src/types/next-auth.d.ts`.
- [ ] T026 [P] `src/server/password.ts`: `hashPassword(plain)` and `verifyPassword(plain, hash)` wrapping `argon2` with OWASP-2024 params (`memoryCost: 19_456`, `timeCost: 2`, `parallelism: 1`, `type: argon2id`).
- [ ] T027 [P] `src/server/role-guard.ts`: `requireSession()` and `requireRole(role | role[])` helpers that throw `AppError(AUTH_SESSION_EXPIRED)` / `AppError(AUTH_FORBIDDEN_ROLE)`; usable from RSC and Route Handlers.
- [ ] T028 [P] `src/server/rate-limit.ts`: `@upstash/ratelimit` with in-memory store; exported limiters for `auth` (5 req / 5 min / IP), `register` (3 req / 1 h / IP), `attachments` (20 req / 1 h / user).
- [ ] T029 NextAuth route handler at `src/app/api/auth/[...nextauth]/route.ts` re-exporting `GET`/`POST` from `auth-options`.
- [ ] T030 [P] Root layout `src/app/layout.tsx`: Tailwind globals import, font setup, `<Toaster />` mount (sonner) once, session-aware `<html lang>` attribute.
- [ ] T031 [P] Auth middleware at `src/middleware.ts`: redirects unauthenticated requests on protected routes to `/login?callbackUrl=…`; allows `/login`, `/register`, `/api/auth/*`, static.
- [ ] T032 [P] Shared validation hub at `src/lib/validation/index.ts` re-exporting feature schemas; install `zod-form-data` if multipart parsing needed.
- [ ] T033 Bootstrap + sweeper at `src/server/bootstrap.ts`: on app start (a) read `BOOTSTRAP_ADMIN_EMAIL`, promote-or-record marker (FR-005b); (b) sweep `./data/uploads/.staging/` files older than 1 h (R-006). Wire from `src/instrumentation.ts` (Next 14 instrumentation hook).
- [ ] T034 [P] Test fixtures `tests/helpers/db.ts`: `withTestDb()` spins up an in-memory SQLite, runs migrations, seeds categories; `tests/helpers/auth.ts`: `seedUser({ role })` returning a session-cookie helper for integration tests.

**Checkpoint**: Foundation ready — user-story phases can begin in parallel.

---

## Phase 3: User Story 1 — Employee submits an innovation idea (Priority: P1) 🎯 MVP

**Goal**: An EMPLOYEE can submit a new idea (title, description, category, optional attachment), see it on "My Ideas", and view its detail page.

**Independent test**: Seed an EMPLOYEE user, log in via test helper, POST `/api/ideas`, then GET `/api/ideas?scope=mine` and the detail page; the idea is `SUBMITTED`, has the correct category, and the attachment downloads with the original bytes.

### Tests for User Story 1

- [ ] T035 [P] [US1] Unit test `src/server/__tests__/idea-service.create.spec.ts` — happy path + duplicate proposed-category name (`CATEGORY_NAME_TAKEN`) + missing both `categoryId` and `proposedCategoryName` (`IDEA_CATEGORY_INVALID`).
- [ ] T036 [P] [US1] Unit test `src/server/__tests__/attachment-service.spec.ts` — magic-number sniff rejects renamed `.exe` (`ATTACHMENT_TYPE_NOT_ALLOWED`); 26 MB file rejected (`ATTACHMENT_TOO_LARGE`); happy commit moves file out of `.staging/`.
- [ ] T037 [P] [US1] Integration test `tests/integration/api/ideas.create.test.ts` — POST `/api/ideas` with attachmentId, GET `/api/ideas?scope=mine`, GET `/api/ideas/{id}` round-trip; envelope shape on validation failure.
- [ ] T038 [P] [US1] E2E test `tests/e2e/submit-idea.spec.ts` — Employee logs in, opens "Submit Idea", fills form with PDF attachment, submits, lands on idea detail; axe-core finds zero serious/critical violations.

### Implementation for User Story 1

- [ ] T039 [P] [US1] Zod schemas at `src/lib/validation/idea.ts`: `CreateIdeaSchema` (title 1–120, description 1–2000, `oneOf` `categoryId`/`proposedCategoryName`), `AttachmentMetadataSchema`.
- [ ] T040 [P] [US1] Repository `src/db/repositories/idea-repo.ts`: `insertIdea`, `findById`, `listByAuthor(authorId)` ordered `updated_at DESC`.
- [ ] T041 [P] [US1] Repository `src/db/repositories/category-repo.ts`: `findActive()`, `findByLowerName(name)`, `insertProposed(name, proposedById)`.
- [ ] T042 [P] [US1] Repository `src/db/repositories/attachment-repo.ts`: `insertStaged`, `commitToIdea(attachmentId, ideaId)`, `findById`, `deleteStaged(olderThanMs)`.
- [ ] T043 [US1] Service `src/server/idea-service.ts`: `createIdea(input, authorId)` in one tx — proposes category if needed, links optional attachment via `commitToIdea`, returns `IdeaDetail`. Depends on T040–T042.
- [ ] T044 [US1] Service `src/server/attachment-service.ts`: `stageUpload(stream, originalName, userId)` — sniffs first 4 KB via `file-type`, validates allow-list + 25 MB cap, writes to `./data/uploads/.staging/<id>__<sanitised>`, persists row. Depends on T028, T042.
- [ ] T045 [P] [US1] Route handler `src/app/api/attachments/route.ts` (POST `multipart/form-data`) wrapped by `withErrorHandler` + `attachments` rate-limiter.
- [ ] T046 [US1] Route handler `src/app/api/ideas/route.ts`: POST (create), GET (`scope=mine` for EMPLOYEE) wrapped by `withErrorHandler`. Depends on T043.
- [ ] T047 [US1] Route handler `src/app/api/ideas/[id]/route.ts` (GET detail) and `src/app/api/ideas/[id]/attachment/route.ts` (GET stream download) — both gated by author-or-reviewer/admin guard.
- [ ] T048 [P] [US1] RSC page `src/app/(employee)/my-ideas/page.tsx` reading `idea-service.listMine()`; renders four-states polish (loading via `<Suspense>`, empty, error boundary, success table) per Principle VI.
- [ ] T049 [P] [US1] Client form at `src/components/forms/idea-form.tsx` (RHF + Zod resolver, shadcn `Form`/`Select`/`Textarea`/`Input`); drives `src/app/(employee)/ideas/new/page.tsx`. Uploads file via `/api/attachments` first, then submits id with idea POST.
- [ ] T050 [P] [US1] RSC page `src/app/(employee)/ideas/[id]/page.tsx` — author view of idea detail (status badge, attachment download link, formatted dates via `formatDateTime`).

**Checkpoint**: US1 functional — Employee can submit and view their own ideas end-to-end.

---

## Phase 4: User Story 2 — Evaluator/Admin reviews and decides on an idea (Priority: P1)

**Goal**: A reviewer (EVALUATOR or ADMIN) sees the review queue, opens an idea, starts review, then approves or rejects with a required comment. ADMIN can additionally mark an `APPROVED` idea as `IMPLEMENTED`.

**Independent test**: Seed an EMPLOYEE-authored `SUBMITTED` idea + an EVALUATOR session; POST `/api/ideas/{id}/transitions` `START_REVIEW` then `APPROVE` with comment; assert idea status flow + a `status_transitions` row exists with the comment.

### Tests for User Story 2

- [ ] T051 [P] [US2] Unit test `src/server/__tests__/idea-state-machine.spec.ts` — every cell of the (from, to, role) table from [data-model.md](./data-model.md): allowed transitions return `{kind:"allow"}`, every other combo returns the right `IDEA_*` deny code (including `IDEA_SELF_EVALUATION_FORBIDDEN`, `IDEA_CATEGORY_PENDING`, `IDEA_COMMENT_REQUIRED`).
- [ ] T052 [P] [US2] Integration test `tests/integration/api/ideas.transitions.test.ts` — start-review → approve happy path, reject without comment → 400, self-evaluation → 403, transition while category PROPOSED → 409, IMPLEMENT by EVALUATOR → 403, IMPLEMENT by ADMIN → 200.
- [ ] T053 [P] [US2] E2E test `tests/e2e/review-idea.spec.ts` — EVALUATOR opens queue, picks idea, starts review, approves with comment; idea moves to APPROVED on author's view; axe-core clean.

### Implementation for User Story 2

- [ ] T054 [P] [US2] Pure state-machine module `src/server/idea-state-machine.ts`: `evaluateTransition(input)` and `canTransition(input)` per [ADR-0004](./adr/0004-state-machine.md); no DB or Node-only imports so it is RSC-and-client safe.
- [ ] T055 [P] [US2] Repository `src/db/repositories/transition-repo.ts`: `insert(record)`, `listByIdea(ideaId)` ordered `recorded_at ASC`.
- [ ] T056 [US2] Extend `src/server/idea-service.ts`: `applyTransition(ideaId, action, comment, actor)` in one tx — re-reads idea + category, calls `evaluateTransition`, writes both the new status and a `status_transitions` row. Depends on T054, T055.
- [ ] T057 [US2] Route handler `src/app/api/ideas/[id]/transitions/route.ts` (POST `{ action, comment }`) wrapped by `withErrorHandler` + `requireRole(['EVALUATOR','ADMIN'])`. Depends on T056.
- [ ] T058 [P] [US2] Add `idea-service.listPending()` ordered `created_at ASC`.
- [ ] T059 [P] [US2] Extend GET `/api/ideas` to honour `scope=queue` (default for EVALUATOR/ADMIN); enforce role-default mismatch via `AUTH_FORBIDDEN_ROLE`.
- [ ] T060 [P] [US2] RSC page `src/app/(reviewer)/queue/page.tsx` — review queue table, sort `created_at ASC`, four-states polish.
- [ ] T061 [US2] Update `src/app/(employee)/ideas/[id]/page.tsx` to (a) render reviewer transition buttons gated by `canTransition()`, (b) render the `StatusTransition` history timeline with actor + comment + `formatDateTime`. Depends on T054.
- [ ] T062 [P] [US2] Client component `src/components/ideas/transition-dialog.tsx` — shadcn `Dialog` + RHF + Zod requiring non-empty trimmed comment for APPROVE/REJECT; sonner toast on success.

**Checkpoint**: US2 functional — reviewers can move ideas through the full state machine; ADMIN can mark implemented.

---

## Phase 5: User Story 3 — User registers, logs in, logs out (Priority: P1)

**Goal**: A new visitor can self-register, the bootstrap admin email is auto-promoted, and any user can log in / log out with the 24-hour sliding session.

**Independent test**: POST `/api/auth/register` with `BOOTSTRAP_ADMIN_EMAIL` → user is `ADMIN`; POST again with another email → `EMPLOYEE`; sign in via NextAuth Credentials → session cookie set; refresh page after 23 h → still authenticated; after 25 h idle → redirected to `/login`.

### Tests for User Story 3

- [ ] T063 [P] [US3] Unit test `src/server/__tests__/password.spec.ts` — `hashPassword` then `verifyPassword` round-trip; verify rejects truncated/garbled hashes.
- [ ] T064 [P] [US3] Integration test `tests/integration/api/auth.register.test.ts` — happy path stores `lower(email)`; duplicate email → 409 `USER_EMAIL_TAKEN`; password failing the 8-char-with-letter-and-digit policy → 400 `USER_PASSWORD_POLICY`; bootstrap-admin promotion fires once.
- [ ] T065 [P] [US3] E2E test `tests/e2e/auth.spec.ts` — register → land on My Ideas; logout; login; landing role-based redirect; axe-core clean.

### Implementation for User Story 3

- [ ] T066 [P] [US3] Zod schemas at `src/lib/validation/auth.ts`: `RegisterSchema` enforcing the 8-char + ≥ 1 letter + ≥ 1 digit policy, `LoginSchema`.
- [ ] T067 [P] [US3] Service `src/server/user-service.ts`: `register(input)` lowercases email, hashes password, inserts user, then calls `role-service.applyBootstrapPromotionIfMatch(userId, email)`.
- [ ] T068 [US3] Route handler `src/app/api/auth/register/route.ts` wrapped by `withErrorHandler` + `register` rate-limiter.
- [ ] T069 [P] [US3] RSC + client form pair `src/app/(public)/login/page.tsx` and `src/components/forms/login-form.tsx` (RHF + Zod, calls `signIn('credentials', …)`, surfaces `AUTH_INVALID_CREDENTIALS`).
- [ ] T070 [P] [US3] RSC + client form pair `src/app/(public)/register/page.tsx` and `src/components/forms/register-form.tsx`.
- [ ] T071 [P] [US3] Header component `src/components/layout/header.tsx` — RSC reads session, renders display name + sign-out button (client island calling `signOut()`).
- [ ] T072 [P] [US3] Extend `src/middleware.ts` for role-aware landing: `/` → `/my-ideas` (EMPLOYEE) or `/queue` (EVALUATOR, ADMIN).

**Checkpoint**: US3 functional — registration, login, logout, sliding session, bootstrap-admin promotion all work.

---

## Phase 6: User Story 4 — Admin manages users and categories (Priority: P2)

**Goal**: An ADMIN can change any user's role (with last-admin-demotion guard), and approve/reject `PROPOSED` categories (with `Other` re-link on reject).

**Independent test**: Seed two ADMINs; PATCH `/api/users/{id}/role` demoting one → 200; demoting the last → 409 `AUTH_LAST_ADMIN_DEMOTION`. Seed a `PROPOSED` category linked to two ideas; PATCH `/api/categories/{id}` `decision: REJECT` → category `REJECTED`, both ideas now linked to `Other`.

### Tests for User Story 4

- [ ] T073 [P] [US4] Unit test `src/server/__tests__/role-service.spec.ts` — last-admin demotion blocked; bootstrap-marker promotion idempotent.
- [ ] T074 [P] [US4] Unit test `src/server/__tests__/category-service.spec.ts` — reject re-links all linked ideas to `Other` in one tx; rejecting the protected `Other` → `CATEGORY_PROTECTED`.
- [ ] T075 [P] [US4] Integration test `tests/integration/api/categories.decisions.test.ts` — approve and reject happy paths; `CATEGORY_NOT_PENDING` on already-decided.
- [ ] T076 [P] [US4] Integration test `tests/integration/api/users.role.test.ts` — happy promote/demote, last-admin guard.
- [ ] T077 [P] [US4] E2E test `tests/e2e/admin-management.spec.ts` — ADMIN logs in, opens admin pages, promotes a user and rejects a proposed category; axe-core clean.

### Implementation for User Story 4

- [ ] T078 [P] [US4] Service `src/server/role-service.ts`: `changeRole(targetUserId, newRole, actor)` with last-admin guard (counts admins in same tx); `applyBootstrapPromotionIfMatch(userId, email)` consumed by US3.
- [ ] T079 [US4] Service `src/server/category-service.ts`: `approve(id, adminId)` and `reject(id, adminId)` — reject runs `re-link-ideas-to-Other` + state change in one tx; protected-category guard. Depends on T041.
- [ ] T080 [P] [US4] Route handler `src/app/api/categories/route.ts` (GET, query `state` filter; default `ACTIVE` non-admin, `all` admin-only).
- [ ] T081 [P] [US4] Route handlers `src/app/api/categories/[id]/route.ts` (PATCH approve|reject) and `src/app/api/users/[id]/role/route.ts` (PATCH role) — both wrapped + `requireRole('ADMIN')`.
- [ ] T082 [P] [US4] Admin page `src/app/(admin)/admin/categories/page.tsx` — table of `PROPOSED` categories with approve/reject buttons; sonner confirmation; explicit "this will re-link N ideas to Other" warning before reject.
- [ ] T083 [P] [US4] Admin page `src/app/(admin)/admin/users/page.tsx` — user table with role dropdown (shadcn `Select`); inline error toast on `AUTH_LAST_ADMIN_DEMOTION`.
- [ ] T084 [P] [US4] Admin layout `src/app/(admin)/layout.tsx` — sidebar with links to Users / Categories, route guarded by `requireRole('ADMIN')`.

**Checkpoint**: US4 functional — admin user/category management complete.

---

## Phase 7: Polish & Cross-cutting

**Purpose**: Pass every constitutional quality gate, ship documentation, and merge per Principle X.

- [ ] T085 [P] CI workflow `.github/workflows/ci.yml`: jobs run `npm ci` → `typecheck` → `lint` → `format` → `test:unit -- --coverage` → `test:integration` → `test:e2e` → `check:error-codes` → `check:ui-tokens` (Quality Gates 1–9). Fail the build on any non-zero step.
- [ ] T086 [P] PR template `.github/pull_request_template.md`: Constitution-compliance checklist (one box per principle), manual a11y checklist, ADR-coverage checkbox (Gate #11), commit-discipline confirmation (Gate #10).
- [ ] T087 [P] `README.md` at repo root: 1-paragraph overview, link to [quickstart.md](./quickstart.md), link to constitution and ADR index, badges placeholder.
- [ ] T088 [P] Update [quickstart.md](./quickstart.md) if any command name changed during implementation; run the quickstart end-to-end from a fresh clone and fix gaps.
- [ ] T089 [P] JSDoc audit per Principle IV: every exported symbol in `src/server/**` and `src/lib/**` has a JSDoc block; eslint-plugin-jsdoc reports zero errors.
- [ ] T090 [P] Manual a11y sweep per Principle VI: keyboard-only nav across `/login`, `/register`, `/my-ideas`, `/ideas/new`, `/ideas/[id]`, `/queue`, `/admin/*`; record findings in PR description.
- [ ] T091 [P] Responsiveness sweep at viewport widths 360 / 768 / 1280 px (Principle VI); screenshots attached to PR.
- [ ] T092 Run `npm run check:error-codes` and `npm run check:ui-tokens`; resolve every finding (Quality Gate #9 hard-failing on this PR).
- [ ] T093 Run [quickstart.md §4 first end-to-end smoke](./quickstart.md) on a fresh clone; verify bootstrap-admin promotion, idea submission, review, mark-implemented all work.
- [ ] T094 **End-of-feature merge (Constitution Principle X)**: ensure Quality Gates 1–11 pass on `001-innovatepam-portal-mvp` HEAD, push, then `git checkout main && git merge --no-ff 001-innovatepam-portal-mvp -m "merge(feature/001): InnovatEPAM Portal MVP" -m "<one-line summary>" -m "ADRs accepted: ADR-0001..ADR-0007" -m "Spec: specs/001-innovatepam-portal-mvp/spec.md"`. The post-merge hook auto-pushes to `origin/main`.

---

## Dependencies & Execution Order

### Phase dependencies

| Phase | Depends on |
|---|---|
| 1 Setup | — |
| 2 Foundational | Phase 1 |
| 3 US1 (P1) | Phase 2 |
| 4 US2 (P1) | Phase 2 (and idea entities from US1 services T040, T043) |
| 5 US3 (P1) | Phase 2 (auth wiring) — UI is independent of US1/US2 |
| 6 US4 (P2) | Phase 2 + role-service path used by US3's bootstrap promotion |
| 7 Polish | All US phases |

### User-story dependencies (cross-story)

- **US1 → US2**: US2 reuses `idea-service.ts` and `idea-repo.ts` from US1. If teams parallelise, US2's T056 can start once US1's T043 lands.
- **US3 ↔ US1/US2**: independent at the page level (auth UI vs. idea UI). NextAuth wiring (T025, T029) is in Foundational, so US1/US2 integration tests can use the test session helper (T034) without waiting for US3 pages.
- **US4 → US3**: `role-service.applyBootstrapPromotionIfMatch` (T078) is consumed by US3's `register` (T067). Easiest sequencing: ship the helper as part of US4 setup but call it from US3.

### Within each user story

- Tests (T035–T038, T051–T053, T063–T065, T073–T077) SHOULD be written first and observed failing.
- Repositories before services; services before route handlers; route handlers before pages.
- Each story closes at a checkpoint where the story is independently runnable.

### Parallel opportunities

- All `[P]` tasks in Phase 1 (T004–T012) after T001–T003.
- All `[P]` tasks in Phase 2 once T013–T015 (schema + migration) land — error registry, format helpers, password util, role guard, rate-limit, fixtures can ship in parallel.
- Within each US phase, all tests `[P]` run in parallel; all repositories `[P]` run in parallel; UI pages `[P]` run in parallel once their service exists.
- US1, US2, US3, US4 phases can be executed by different developers in parallel after Phase 2 closes (US2 needs the US1 service skeleton T043; can be stubbed).

---

## Parallel example: User Story 1

```text
# Tests for US1 (write first):
T035 idea-service.create.spec.ts
T036 attachment-service.spec.ts
T037 ideas.create.test.ts (integration)
T038 submit-idea.spec.ts (e2e)

# Independent implementation in parallel:
T039 src/lib/validation/idea.ts
T040 src/db/repositories/idea-repo.ts
T041 src/db/repositories/category-repo.ts
T042 src/db/repositories/attachment-repo.ts
```

---

## Implementation Strategy

### MVP (User Story 1 only)

1. Phase 1: Setup.
2. Phase 2: Foundational (CRITICAL — blocks all stories).
3. Phase 3: User Story 1.
4. **STOP and validate**: run T038 + the quickstart smoke for US1.
5. Demo / commit.

### Incremental delivery

1. Setup + Foundational → foundation ready.
2. US1 → demo / merge into a `001-` integration commit.
3. US3 → so users can self-onboard.
4. US2 → review workflow goes live.
5. US4 → admin tooling.
6. Polish → CI green, gates 1–11 pass, **merge to `main` non-ff** (T094).

### Parallel team strategy

- Dev A: US1 (T035–T050).
- Dev B: US2 (T051–T062), starting once T043 stub exists.
- Dev C: US3 (T063–T072) + US4 helper T078.
- Dev D: Polish (T085–T093) starts in the last sprint, finalises with T094.

---

## Notes

- Every `[US#]` task carries an explicit file path so an LLM (or human) can pick it up without further context.
- Tests in this list are RECOMMENDED order; coverage threshold (Constitution III) is enforced in T010 by `vitest.config.ts` — the build fails if `src/server/**` drops below 70 %.
- Every transition or category decision MUST land via the services in `src/server/`; Route Handlers are thin adapters around Zod + service + envelope.
- All non-2xx responses MUST flow through `withErrorHandler` (Constitution VII) — no hand-rolled JSON errors anywhere.
- After each task completes, the post-commit hook (Constitution VIII) auto-pushes; no manual push required.
- The final task T094 is the only place where a feature branch lands on `main` (Constitution X).
