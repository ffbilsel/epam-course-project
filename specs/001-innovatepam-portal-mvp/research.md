# Phase 0 Research — InnovatEPAM Portal MVP

This document records the technology decisions made for the plan, the
alternatives considered, and the rationale for each choice. All
decisions are bounded by the Constitution v1.4.0 (TypeScript strict,
Next.js stack already mandated, SQLite, shadcn/ui, 70% line coverage,
WCAG 2.1 AA, error-code registry, ADR-backed design choices,
feature merge discipline).

---

## R-001 — Authentication library

**Decision**: NextAuth.js v5 with the **Credentials** provider, sessions
persisted via the database adapter (`@auth/drizzle-adapter`), JWT
strategy disabled in favour of database sessions so we can revoke on
logout (FR-003) and enforce 24-hour sliding expiry deterministically
(FR-004).

**Why**: Native Next.js App Router integration; gives us
`auth()` and `getServerSession()` helpers across server components and
route handlers; CSRF protection is built in (Principle FR-027); no
need to author session cookie + CSRF token plumbing by hand.

**Alternatives considered**:
- **Lucia v3**: lighter, but more glue code; no community Drizzle
  recipe with sliding sessions out of the box → more bespoke code
  under the 70% test floor.
- **Roll-our-own** with `iron-session` + `argon2`: maximum control but
  re-invents wheels (CSRF, account lockout primitives, session table).
  Not justified for a 6-hour MVP.
- **Clerk / Auth0**: external SaaS — violates the "single tenant,
  local infra only" assumption from spec.md (and adds setup tax).

**Constitutional traceability**: FR-001…FR-006, FR-026 (no enumeration),
FR-027 (CSRF).

---

## R-002 — Password hashing

**Decision**: **argon2id** via `argon2` (node-rs binding), parameters
`{ type: argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 }`
(OWASP 2024 baseline).

**Why**: OWASP-recommended modern KDF; node-rs binding is pure Rust →
no native build tooling required on common Windows/macOS/Linux dev
machines.

**Alternatives considered**:
- **bcrypt**: still acceptable but has a 72-byte password limit and
  requires native build tools on Windows in some CI images.
- **PBKDF2**: still FIPS-friendly but slower for the same security
  margin and unfashionable for new code.

---

## R-003 — Database driver & ORM

**Decision**: **Drizzle ORM** on top of **`better-sqlite3`**.

**Why**:
- Synchronous SQLite driver fits Node well; faster than `node:sqlite`
  on writes; battle-tested.
- Drizzle is type-safe (matches Principle II), generates SQL
  migrations we can check in (`drizzle-kit generate`), and works
  cleanly with both `better-sqlite3` and `node:sqlite` if we swap
  later. Repository layer wraps Drizzle so the ORM choice is
  reversible.

**Alternatives considered**:
- **Prisma**: nicer DX but heavyweight (binary engine), slower cold
  start, and harder to swap drivers. Migrations are also less
  hand-editable.
- **Raw SQL via `better-sqlite3`**: minimum dependencies but loses
  compile-time safety on column names; we'd hand-roll types.
- **Kysely**: comparable to Drizzle, slightly less mature ecosystem
  for SQLite migrations.

---

## R-004 — Idea status state machine

**Decision**: Encode the allowed transitions (FR-021) as a typed
constant `transitions: Record<IdeaStatus, IdeaStatus[]>` plus a single
`canTransition(from, to, actorRole, actorId, idea)` pure function in
`src/server/ideas/idea-state-machine.ts`. All writes go through a
`transitionIdea(idea, to, actor, comment)` service that:

1. Calls `canTransition` and throws `AppError(IDEA_INVALID_TRANSITION)`
   on a no.
2. Enforces self-evaluation rule (FR-022 → `IDEA_SELF_EVALUATION_FORBIDDEN`).
3. Enforces category-must-be-active rule (FR-022a →
   `IDEA_CATEGORY_PENDING`).
4. Enforces role rule for `IMPLEMENTED` (FR-019a →
   `AUTH_FORBIDDEN_ROLE`).
5. Persists a `StatusTransition` row and updates `Idea.status` in a
   single SQLite transaction.

**Why**: Pure-function core makes unit testing trivial (one test per
edge of the graph + one negative test per rule = full state-machine
coverage well above the 70% floor); transactional write keeps the log
and current state consistent.

**Alternatives considered**:
- **xstate**: overkill for 5 states and 6 edges.
- **Inline checks at each route handler**: scatters domain rules
  across HTTP layer; violates Principle I (SRP) and makes tests
  brittle.

---

## R-005 — Category proposal flow

**Decision**: Categories are first-class entities with a
`{ ACTIVE | PROPOSED | REJECTED }` state. The submission API accepts
either `categoryId` (existing ACTIVE) or `proposedCategoryName`
(new). When `proposedCategoryName` is supplied, the
`category-service.proposeCategory(name, proposerId)` runs inside the
same DB transaction as the idea-create so failures don't leave orphan
PROPOSED categories. Approval flips state to ACTIVE; rejection flips
to REJECTED **and** re-points every Idea linked to it to the
non-deletable `Other` category in a single transaction.

**Why**: Matches the spec decision (Q5 = A + propose-new). Keeping
PROPOSED categories invisible in the dropdown (FR-008d) but linkable
prevents reviewers from acting on ideas with unvetted classification
(FR-022a) without blocking the submitter.

**Alternatives considered**:
- **Free-text category** on Idea: simpler but loses the curated
  vocabulary the brief asked for.
- **Block ideas with rejected proposed category** (require author to
  edit) instead of fall-back to Other: more user friction; the chosen
  default keeps history navigable. (User confirmed default in
  clarification reply.)

---

## R-006 — Attachment storage

**Decision**: Local filesystem under `./data/uploads/<idea-id>/`,
filename `${attachmentId}__${sanitisedOriginalName}`. The
`attachment-service` wraps writes in a "stage → commit" pattern: file
is first written to `./data/uploads/.staging/${attachmentId}` and only
moved to its final path after the parent Idea row commits, so a
failure on the DB side leaves only a staging file that a startup
sweeper deletes.

**Why**: Matches "no cloud object storage in Phase 1" assumption.
Stage-then-commit eliminates the orphan-file risk demanded by SC-007
without needing a two-phase commit between FS and DB.

**MIME validation**: we use the `file-type` package to read the first
4 KB and confirm magic-number bytes match the declared MIME against
the allow-list (FR-010). Failures throw `ATTACHMENT_TYPE_NOT_ALLOWED`.

**Alternatives considered**:
- **Database BLOB**: bloats SQLite, slow for download streaming.
- **S3-compatible (MinIO) abstraction now**: premature; can be added
  in Phase 2 by swapping `attachment-service` for an S3 client behind
  the same interface.

---

## R-007 — Validation library

**Decision**: **Zod** at every boundary: API route bodies, server
action inputs, env vars (via `zod` + a small `env.ts` parser), and
the SQLite row → domain object hydration where a row is not type-safe
yet. Forms use **React Hook Form + `@hookform/resolvers/zod`** so
client and server share schemas.

**Why**: Constitution mandates Zod at boundaries (Principle II);
sharing schemas between client and server avoids drift between client
hint and server truth (FR-025).

---

## R-008 — Error-code registry mechanics

**Decision**: `src/lib/errors/codes.ts` exports
`export const ERROR_CODES = { AUTH_INVALID_CREDENTIALS: { http: 401 },
… } as const;` plus `export type ErrorCode = keyof typeof ERROR_CODES;`.
`AppError` is constructed as
`new AppError('IDEA_TITLE_REQUIRED', { details: { field: 'title' } })`
and looks up its HTTP status from the table.

A CI script `scripts/check-error-codes.ts` parses the registry and
greps `src/**/*.ts` to fail when:
- a code string appears in source but is not in the registry, or
- a code is in the registry but neither used in source nor referenced
  in `tests/**/*.test.ts` (gate #9, third bullet of constitution).

The route-handler wrapper `withErrorHandler` catches `AppError` →
emits the constitutional envelope; catches anything else → wraps as
`INTERNAL_ERROR` and logs the original (Principle VII.3).

**Why**: Single source of truth, machine-checkable, aligned with the
constitution's "advisory-failing → hard-failing" trajectory for gate
#9.

---

## R-009 — Testing infra

**Decision**: Vitest 1.6 with two `vitest.config.ts` projects (`unit`,
`integration`); E2E via Playwright 1.45 with `@axe-core/playwright`.

- **Unit**: `jsdom` env for component tests, `node` for pure logic;
  no DB, no FS, no network. Repositories are replaced with
  in-memory fakes implementing the same interface
  (`src/db/repositories/*.fake.ts` lives under `tests/unit/_fakes/`
  to keep production code clean).
- **Integration**: per suite, `_setup.ts` boots a fresh SQLite file
  in `os.tmpdir()`, runs all migrations, seeds the bootstrap admin
  + categories, builds a test app instance, tears down in
  `afterAll`. Route handlers are exercised by constructing a real
  `Request` and calling the handler directly (no extra HTTP server
  needed for App Router).
- **E2E**: 5 journey specs (one per P1 user story plus admin-only
  flows). Each navigates at desktop **and** the 360 × 640 mobile
  viewport (Principle VI verification rule).

**Why**: Matches Principle V.8 verbatim; only swap is Vitest in place
of Jest (already approved in the constitution clarifier).

---

## R-010 — UI: state-management & toasts

**Decision**: React Server Components for read paths; client components
only where interactivity is required (forms, dialogs, dropdowns).
`sonner` for toasts, mounted once in `app/layout.tsx`. Optimistic
updates via `useOptimistic` are out of scope for Phase 1 — a
`router.refresh()` after each mutation is sufficient for the data
volumes we expect (≤ 10 000 ideas).

**Why**: Server-first matches Next.js App Router idioms and minimises
JS shipped to the browser, helping mobile budgets (Principle VI.1).
Sonner is the shadcn-blessed toast library and inherits its
accessibility primitives (Principle VI.2).

---

## R-011 — Date / locale

**Decision**: Auto-detect locale via `navigator.language` for the
client; on the server fall back to `en-US`. Two helpers in
`src/lib/format/`: `formatDate(date)` → "May 12, 2026" style,
`formatDateTime(date)` → "May 12, 2026, 4:32 PM". Both wrap
`date-fns`'s `format` with `Intl.DateTimeFormat` for the locale.

**Why**: Locale Q9 = C in clarifications. Centralising the helpers
satisfies Principle VII.1 ("no inline `toLocaleString` in
components").

---

## R-012 — Rate limiting

**Decision**: In-process token-bucket limiters via
`rate-limiter-flexible`'s `RateLimiterMemory` on `/api/auth/*`,
`/api/auth/register`, and `POST /api/attachments`. Phase 1 deliberately
avoids any external Redis or message broker (per plan.md Constraints).
**Code**: `RATE_LIMITED` (HTTP 429) returned via the standard error
envelope.

**Why**: Without it, the login endpoint becomes a brute-force
playground. `rate-limiter-flexible`'s in-memory store is fine for a
single-process Node deployment in Phase 1; swapping to a distributed
store later is a one-line constructor change.

> **Amendment (2026-05-12)**: this supersedes the earlier note that
> mentioned `@upstash/ratelimit`'s "in-memory adapter" — that package
> is a Redis client and has no in-memory backend, so the new choice is
> the only one that satisfies the no-external-Redis constraint. The
> companion mention in [adr/0005-attachment-storage.md](./adr/0005-attachment-storage.md)
> is amended by this research note (ADRs are immutable; the
> implementation tasks T028 and the plan use `rate-limiter-flexible`).

---

## Open items

None. Every `[NEEDS CLARIFICATION]` from spec.md is resolved either by
the Clarifications session or by a decision in this document.
