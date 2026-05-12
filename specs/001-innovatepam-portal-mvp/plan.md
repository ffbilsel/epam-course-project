# Implementation Plan: InnovatEPAM Portal — Phase 1 MVP

**Branch**: `001-innovatepam-portal-mvp` | **Date**: 2026-05-12 |
**Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from
`/specs/001-innovatepam-portal-mvp/spec.md`

## Summary

Build a single-tenant Next.js 14 web app where Employees submit
innovation ideas (title, description, category, optional single
attachment) and Evaluators/Admins drive each idea through a fixed
state machine (`SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED`,
`APPROVED → IMPLEMENTED`). Auth is local email + password with three
roles. Categories are first-class entities with an
Employee-proposes / Admin-approves workflow. Persistence is SQLite
behind a thin repository layer; attachments live on the local
filesystem. Every API response that is not 2xx returns the
constitutional error envelope (`{ error: { code, message, details } }`)
keyed off a single error-code registry. Tests run on Vitest + RTL +
Playwright with a 70% line-coverage floor on business logic.

## Technical Context

**Language/Version**: TypeScript ~5.4 (strict mode + `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `noImplicitOverride`,
`noFallthroughCasesInSwitch`); Node.js `>=20 <21`.
**Primary Dependencies**: Next.js 14 (App Router), React 18, Tailwind CSS,
shadcn/ui (Radix primitives), Zod (validation), React Hook Form,
NextAuth.js `^5.0.0-beta.20` (Credentials provider) with
`@auth/drizzle-adapter`, Drizzle ORM + `better-sqlite3`, `date-fns`,
`lucide-react`, `class-variance-authority`, `sonner` (toasts),
`argon2` (password hashing), `file-type` (magic-number sniffing),
`pino` (structured logging — FR-028), `rate-limiter-flexible`
(in-process rate limiting — FR-029).
**Storage**: SQLite via `better-sqlite3` at `./data/innovatepam.db`
(production) / temp file per suite (test). Attachments on local FS at
`./data/uploads/<idea-id>/<attachment-id>__<original-name>`. Schema
managed by Drizzle migrations (`./drizzle/*.sql`).
**Testing**: Vitest 1.6 (`unit`, `integration` projects) + RTL 16 +
`@testing-library/jest-dom` + `@testing-library/user-event`;
Playwright 1.45 for E2E with `@axe-core/playwright`.
**Target Platform**: Modern evergreen browsers (latest Chromium,
Firefox, Safari) on desktop, tablet, and mobile ≥ 360 px wide. Server
runs on Node 20 inside any Linux/Windows/macOS host.
**Project Type**: Full-stack web app (Next.js with API route handlers
and server actions).
**Performance Goals**: P95 page TTI < 2.5 s on a mid-tier laptop with
the local SQLite; idea-list query (≤ 1 000 ideas, single-author scope)
returns in < 100 ms; attachment download streams without buffering the
whole file.
**Constraints**: Single-tenant; local FS only (no S3); local SQLite
only (no Postgres); no email sending in Phase 1; no external Redis or
message broker (rate limiting is in-process via
`rate-limiter-flexible`); CSRF-protected state changes via NextAuth's
built-in CSRF token; OWASP Top-10 hygiene applied at the API boundary.
**Scale/Scope**: ≤ 1 000 active users, ≤ 10 000 ideas total in Phase 1.
~29 functional requirements (FR-001…FR-029), 4 user stories, 4
entities, ~16 API endpoints, ~8–10 pages.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at **v1.4.0** has **10 principles** and **12 quality
gates**. Each is evaluated below for this plan; **no violations require
justification**.

### Principle compliance

| Principle | Compliance |
|---|---|
| **I. Clean Code** | All modules thin & single-purpose; functions ≤ 30 LOC, complexity ≤ 10. Repository pattern isolates DB; service layer isolates business logic from HTTP. No dead code, no unmarked TODOs. |
| **II. TypeScript Strict** | `tsconfig.json` will set the full strict family per the constitution. All HTTP/DB boundaries parse with Zod; no `any`, no `!`, no `@ts-ignore`. |
| **III. Testing Pyramid 70%** | Coverage gated by `vitest.config.ts` `coverage.thresholds` on `src/server/**` and `src/lib/**` (excluding `src/app/**`, `src/components/ui/**`). |
| **IV. JSDoc** | `eslint-plugin-jsdoc` `recommended` enforces doc presence on every exported symbol, including component props. |
| **V. Testing Principles** | Vitest projects (`unit`, `integration`) + Playwright (`e2e`); AAA layout; `beforeEach` isolation; repository fakes for unit tests; magic numbers traceable to spec FRs. |
| **VI. UX (responsive, a11y, polish)** | Tailwind mobile-first; shadcn/ui (Radix) preserves a11y primitives; every screen wires explicit loading/empty/error/success states (`Suspense` + `error.tsx` + `loading.tsx` + `sonner`); `eslint-plugin-jsx-a11y` + `@axe-core/playwright` enforced. |
| **VII. Consistency (UI, code, error codes)** | shadcn primitives only; `cva` variants; `lucide-react` only; `formatDate`/`formatDateTime` helpers; centralised `errorMessages` map; **error-code registry at `src/lib/errors/codes.ts`** with one entry per spec error path; **`AppError`** class with `code` + `httpStatus` + `details`; uniform `{ error: { code, message, details } }` envelope at every API route via a shared `withErrorHandler` wrapper. |
| **VIII. Commit & Push Discipline** | SpecKit `.specify/extensions.yml` `auto_commit` map plus `.git/hooks/post-commit` push hook installed via `pwsh project/scripts/install-hooks.ps1` (T012). Each lifecycle step + each task lands as a Conventional Commit and is auto-pushed to `origin`. |
| **IX. ADR-Backed Design Choices** | Every load-bearing choice in this plan has a MADR-formatted ADR under [./adr/](./adr/): rendering & framework (0001), storage & ORM (0002), authentication (0003), state machine (0004), attachment storage (0005), validation & errors (0006), UI & design system (0007). New design choices added in Phase 1 implementation MUST land an ADR in the same PR. |
| **X. Feature Merge Discipline** | Feature branch `001-innovatepam-portal-mvp` merges to `main` exclusively via `git merge --no-ff` once Quality Gates 1–11 pass. Encoded as the final task T094. |

### Quality gates

| # | Gate | How this plan satisfies it |
|---|---|---|
| 1 | `tsc --noEmit` strict | `npm run typecheck` in CI; `tsconfig.json` per Principle II. |
| 2 | ESLint + Prettier zero errors | `eslint-config-next` + `@typescript-eslint` + `jsdoc` + `jsx-a11y` + `import`; Prettier with project config. |
| 3 | Unit + integration + E2E pass | Three Vitest projects + Playwright config (see [./quickstart.md](./quickstart.md)). |
| 4 | ≥ 70% line on business logic | Threshold in `vitest.config.ts`; `src/server/**` + `src/lib/**` (excl. `errors/codes.ts`). |
| 5 | JSDoc on exports | `eslint-plugin-jsdoc` rules `require-jsdoc`, `require-description`, `require-returns`, `require-param`. |
| 6 | Code review / Constitution compliance note | Solo course project: self-review with rationale per PR. |
| 7 | Constitution Check satisfied | This section. |
| 8 | A11y/responsiveness | jsx-a11y in lint; axe in every Playwright spec; manual checklist in PR description; mobile-viewport smoke for each P1 story. |
| 9 | Consistency | Error-code registry with per-code unit test; UI-token check (no hex/arbitrary Tailwind values outside `components/ui/`); error-envelope integration test. |
| 10 | Commit & push discipline | SpecKit `auto_commit` hooks (`.specify/extensions.yml`) + `post-commit` push hook installed by T012; reviewed in PR template. |
| 11 | ADR coverage | ADR-0001–0007 already accepted; PR template (T086) adds an ADR-coverage checkbox; CI grep ensures every Phase-1 design choice cited in plan/tasks links an ADR. |
| 12 | Feature merge-back | Final task T094 performs the non-fast-forward merge to `main` after Gates 1–11 are green. |

### Excluded coverage paths (documented per V.2)

`src/app/**` (Next.js page/layout files), `src/components/ui/**`
(shadcn-generated), `src/lib/errors/codes.ts` (data-only registry),
`src/db/migrations/**` (generated SQL), `src/db/seed.ts` (one-off
seeding script — exercised through integration tests anyway).

**Result**: PASS. Re-check after Phase 1 design — no expected drift.

## Project Structure

### Documentation (this feature)

```text
specs/001-innovatepam-portal-mvp/
├── plan.md              # This file
├── spec.md              # Authoritative spec (already authored)
├── research.md          # Phase 0 — decisions & alternatives considered
├── data-model.md        # Phase 1 — entities, fields, state machines
├── quickstart.md        # Phase 1 — run/test/migrate locally
├── contracts/
│   └── openapi.yaml     # Phase 1 — REST contract for all routes
└── tasks.md             # Phase 2 — generated by /speckit.tasks
```

### Source Code (repository root)

```text
project/
├── drizzle/                       # Generated SQL migrations
├── data/                          # Runtime: db file + uploads (gitignored)
├── public/
├── src/
│   ├── app/                       # Next.js App Router (UI + API)
│   │   ├── layout.tsx
│   │   ├── page.tsx               # Landing → role-based redirect
│   │   ├── globals.css
│   │   ├── error.tsx              # Global error boundary
│   │   ├── loading.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (employee)/
│   │   │   ├── my-ideas/page.tsx          # My Ideas (FR-014)
│   │   │   └── ideas/
│   │   │       ├── new/page.tsx           # Submit Idea
│   │   │       └── [id]/page.tsx          # Idea detail (author + reviewer view)
│   │   ├── (reviewer)/
│   │   │   └── queue/page.tsx             # Review queue (Evaluator/Admin)
│   │   ├── (admin)/
│   │   │   └── admin/
│   │   │       ├── users/page.tsx         # Role management
│   │   │       └── categories/page.tsx    # Approve/reject proposals
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       ├── auth/register/route.ts            # POST register (FR-001)
│   │       ├── ideas/route.ts
│   │       ├── ideas/[id]/route.ts
│   │       ├── ideas/[id]/transitions/route.ts   # start-review/approve/reject/implement
│   │       ├── ideas/[id]/attachment/route.ts    # GET (download)
│   │       ├── attachments/route.ts              # POST (upload, returns id)
│   │       ├── categories/route.ts               # GET active, POST propose
│   │       ├── categories/[id]/route.ts          # PATCH approve/reject (admin)
│   │       └── users/[id]/role/route.ts          # PATCH (admin)
│   ├── components/
│   │   ├── ui/                    # shadcn primitives (button, input, dialog, …)
│   │   ├── ideas/                 # IdeaCard, IdeaForm, StatusBadge, IdeaTimeline
│   │   ├── review/                # ReviewQueueTable, DecisionForm, StartReviewButton
│   │   ├── admin/                 # UserRoleSelect, CategoryProposalRow
│   │   └── shared/                # Navbar, RoleGuard, FileUploader, EmptyState
│   ├── server/                    # Business logic (covered by 70% floor)
│   │   ├── auth-options.ts            # NextAuth config (T025)
│   │   ├── password.ts                # argon2 hash/verify (FR-002)
│   │   ├── role-guard.ts              # requireSession / requireRole (FR-006)
│   │   ├── rate-limit.ts              # rate-limiter-flexible limiters (FR-029)
│   │   ├── bootstrap.ts               # admin bootstrap + staging sweep (FR-005b, SC-007)
│   │   ├── user-service.ts            # register, lookup
│   │   ├── role-service.ts            # FR-005a (last-admin guard) + bootstrap promotion
│   │   ├── idea-service.ts            # CRUD + queries + transitions (FR-007, FR-021)
│   │   ├── idea-state-machine.ts      # pure transition table (FR-021)
│   │   ├── attachment-service.ts      # stage/commit/cleanup (FR-009–FR-011, SC-007)
│   │   ├── category-service.ts        # propose / approve / reject (FR-008b–c)
│   │   ├── category-bootstrap.ts      # FR-008a seed
│   │   └── infra/
│   │       ├── clock.ts               # injectable Clock port (Constitution V.6)
│   │       ├── id-generator.ts        # injectable IdGen port
│   │       └── logger.ts              # pino structured logger (FR-028)
│   ├── db/
│   │   ├── schema.ts              # Drizzle schema (mirrors data-model.md)
│   │   ├── client.ts              # better-sqlite3 + Drizzle instance
│   │   ├── repositories/          # one per aggregate root
│   │   │   ├── user-repo.ts
│   │   │   ├── idea-repo.ts
│   │   │   ├── attachment-repo.ts
│   │   │   ├── category-repo.ts
│   │   │   └── transition-repo.ts
│   │   └── seed.ts                # categories + bootstrap admin
│   ├── lib/
│   │   ├── errors/
│   │   │   ├── codes.ts           # Single registry (Principle VII.3)
│   │   │   ├── app-error.ts       # AppError class
│   │   │   ├── error-messages.ts  # UI code → user copy
│   │   │   └── with-error-handler.ts  # Route-handler wrapper → envelope
│   │   ├── format/
│   │   │   ├── format-date.ts     # date-fns wrapper
│   │   │   └── format-number.ts
│   │   ├── permissions.ts         # role helpers
│   │   └── utils.ts               # cn() etc.
│   ├── types/
│   │   └── index.ts
│   └── middleware.ts              # NextAuth session + CSRF + role redirect
├── tests/
│   ├── unit/                      # Mirrors src/ — no I/O
│   │   ├── server/
│   │   ├── lib/
│   │   └── components/
│   ├── integration/               # Real SQLite + route handlers via Request
│   │   ├── _setup.ts              # tmp DB + migrate + seed
│   │   ├── auth-register.test.ts
│   │   ├── auth-login.test.ts
│   │   ├── ideas-create.test.ts
│   │   ├── ideas-list-mine.test.ts
│   │   ├── ideas-transitions.test.ts
│   │   ├── ideas-self-evaluation.test.ts
│   │   ├── attachments-upload.test.ts
│   │   ├── categories-propose.test.ts
│   │   ├── categories-approve-reject.test.ts
│   │   ├── users-role.test.ts
│   │   └── error-envelope.test.ts        # Gate 9 sentinel
│   └── e2e/                       # Playwright (≤ 5 journeys)
│       ├── employee-submit-idea.spec.ts
│       ├── reviewer-decide-idea.spec.ts
│       ├── admin-mark-implemented.spec.ts
│       ├── admin-approve-category.spec.ts
│       └── auth-register-login-logout.spec.ts
├── scripts/
│   ├── check-error-codes.ts       # Gate 9 — registry/usage in sync
│   └── check-ui-tokens.ts         # Gate 9 — no hex/arbitrary outside ui/
├── .env.example                   # BOOTSTRAP_ADMIN_EMAIL, NEXTAUTH_SECRET, DATABASE_URL
├── drizzle.config.ts
├── playwright.config.ts
├── vitest.config.ts
├── tailwind.config.ts
├── components.json                # shadcn config
├── next.config.js
├── tsconfig.json
└── package.json
```

**Structure Decision**: Single Next.js project (Option 1, web variant).
The full-stack nature of Next.js makes a separate `backend/` + `frontend/`
split (template Option 2) unnecessary; the constitution's
business-logic coverage path (`src/server/**`) cleanly separates
testable domain code from `src/app/**` (UI/glue, excluded from
threshold). All shadcn primitives live under `src/components/ui/`
exactly as the constitution requires.

## Phase 0 — Research

See [./research.md](./research.md) for decisions and alternatives
considered (auth library, ORM, state-machine encoding, attachment
storage, etc.). All decisions resolve to dependencies already pinned in
"Technical Context" above; no open `[NEEDS CLARIFICATION]` remain.

## Phase 1 — Design Artifacts

- **Data model**: [./data-model.md](./data-model.md) — entities,
  attributes, relationships, state machines (Idea status, Category
  state), invariants, and the Drizzle schema mapping.
- **API contract**: [./contracts/openapi.yaml](./contracts/openapi.yaml)
  — every endpoint listed in the route map above, with request/response
  shapes and the constitutional error envelope.
- **Quickstart**: [./quickstart.md](./quickstart.md) — local setup,
  env vars, scripts, test commands, seed-data overview.

## Constitution Re-check (post-Phase 1)

No new dependencies, no new exclusions, no new violations introduced
by the Phase 1 artifacts. The error-code registry, `AppError` class,
and `withErrorHandler` wrapper are baked into the source-tree layout
above and traced 1:1 to spec error paths in `data-model.md`. **PASS**.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

*No violations to track. All structural and tooling choices map
directly to a constitutional requirement.*
