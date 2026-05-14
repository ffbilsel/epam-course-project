# InnovatEPAM Portal — Project Summary

**Author**: Fatih Furkan Bilsel  
**Date**: 12 May 2026  
**Course**: A201 — Beyond Vibe Coding

---

## 1. Project Overview

InnovatEPAM Portal is an internal **employee innovation management platform** for EPAM. It is a small-org, local-first web application that lets:

- **Employees** submit creative ideas (title, description, category, optional file attachment) and propose new categories.
- **Evaluators** review ideas in a queue, start review, and approve/reject with comments.
- **Admins** do everything Evaluators do, plus manage users (promote/demote roles), approve/reject proposed categories, edit per-category form schemas, and mark approved ideas as `IMPLEMENTED`.

Built as the capstone for the EPAM A201 course as a **Spec-Driven Development (SDD)** exercise using **GitHub SpecKit + GitHub Copilot**. The repository contains formal specs, ADRs, a constitution with quality gates, and a fully runnable Next.js app with offline SQLite storage.

Phase 1 covers the MVP (auth, submission, review). Phase 2 adds **Smart Submission Forms** (admin-defined per-category dynamic field schemas with runtime Zod validation and label snapshots). Phase 3 adds **Idea Listing & Management** (author self-service edit/delete, server-side filtering/search/pagination, a combined audit timeline, and an admin CSV export).

---

## 2. Features Implemented

### Phase 1 — Core Portal MVP (complete)

- **Auth**: registration, login, logout (NextAuth Credentials, DB sessions, 24 h sliding).
- **Three roles**: `EMPLOYEE`, `EVALUATOR`, `ADMIN`. First admin bootstrapped via `BOOTSTRAP_ADMIN_EMAIL` (one-shot, audited).
- **Password policy**: ≥8 chars, ≥1 letter + ≥1 digit (Argon2 hashed).
- **Idea submission**: title, description, category, single attachment (PDF/PNG/JPEG/DOCX/PPTX, ≤25 MB, magic-number MIME sniff).
- **Category lifecycle**: `ACTIVE` / `PROPOSED` / `REJECTED`; seeded list (Process Improvement, Product Innovation, Tooling, Customer Experience, Other-protected). Employees can propose at submission time.
- **My Ideas** list (employee), **Review queue** (evaluator/admin), idea detail page with attachment download.
- **Idea state machine** with audit log of every transition (`status_transitions` table).
- **Admin screens**: user role management, category approval, category schema editor.

### Phase 2 — Smart Submission Forms (complete)

- Admin-defined per-category field schemas (short text, long text, number, single-choice, yes/no; required flag).
- Dynamic form fields appear inline when category is selected; runtime Zod validation.
- Structured answers stored against the idea with **label snapshots** (so renames/deletes don't lose review-time info).
- Reviewer detail page renders answers grouped under category name.
- Orphaned answers (field removed from schema later) still render under last known label.

### Phase 3 — Idea Listing & Management (complete)

- **Author edit & delete** on `SUBMITTED` ideas (title, description, category, attachment, structured answers). Edits are recorded as `from = to` rows in `status_transitions` so the timeline shows them alongside reviewer decisions (ADR-0015).
- **Shared listing contract**: server-side `q`, `categoryId`, multi-`status`, `from`/`to` date range, `scope` (`mine` / `queue` / `all`), and pagination (20 / 50 / 100). Identical filter bar across My Ideas, the reviewer queue, and the admin all-ideas page (ADR-0014).
- **Out-of-range pages clamped server-side** with `Cache-Control: no-store` to avoid stale redirects.
- **History tab**: a unified audit timeline that folds the synthesised submission event, author edits, and reviewer transitions into one chronological feed; author plus reviewers/admins can read, everyone else gets `AUTH_FORBIDDEN_ROLE`.
- **Admin CSV export**: RFC 4180-quoted streaming download from `/api/ideas/export`, scoped to the current filter set, with a `idea_export` security log entry on completion (ADR-0016).

### Phases 4–7

Not implemented in this codebase (no multi-attachment, draft, multi-stage, blind-review, or scoring features).

### Implemented routes (App Router)

- `(public)/login`, `(public)/register`
- `(employee)/ideas/new`, `(employee)/ideas/[id]`, `(employee)/my-ideas`
- `(reviewer)/queue`
- `(admin)/admin/users`, `(admin)/admin/categories`
- API routes: `auth/register`, `auth/[...nextauth]`, `attachments`, `categories`, `categories/[id]`, `categories/[id]/schema`, `ideas`, `ideas/[id]`, `ideas/[id]/attachment`, `ideas/[id]/transitions`, `users/[id]/role`

---

## 3. Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | **Next.js 14** (App Router, RSC-first) |
| Language | **TypeScript 5** strict (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) |
| UI | **React 18**, **Tailwind CSS**, **shadcn/ui** (Radix primitives), `lucide-react`, `sonner` |
| Forms | **react-hook-form** + `@hookform/resolvers` + **Zod** |
| Auth | **NextAuth v5 beta** (Credentials provider) + **@auth/drizzle-adapter**, DB sessions, **argon2** |
| Database | **SQLite** (`better-sqlite3`) — local file `data/innovatepam.db` |
| ORM / Migrations | **Drizzle ORM 0.33** + **drizzle-kit** |
| Validation / Errors | **Zod** + typed `ERROR_CODES` registry |
| State machine | Pure-function transition evaluator (importable from RSC + client) |
| Attachments | Local-disk staged storage, `file-type` magic-number sniff |
| Logging / Rate limit | `pino`, `rate-limiter-flexible` |
| Testing | **Vitest** (unit + integration, v8 coverage), **Playwright** (E2E, Chromium/Firefox/WebKit), **@axe-core/playwright**, **@testing-library/react** |
| Tooling | ESLint (next + jsx-a11y + jsdoc), Prettier, custom scripts `check:error-codes` and `check:ui-tokens` |

### Architecture Decision Records

Phase 1 (`specs/001-innovatepam-portal-mvp/adr/`):
- 0001 Rendering & framework — Next.js 14 App Router, RSC-first
- 0002 Storage & ORM — SQLite + Drizzle
- 0003 Authentication — NextAuth Credentials + DrizzleAdapter, DB sessions
- 0004 State machine — pure-function transitions
- 0005 Attachment storage — local-disk staged
- 0006 Validation & errors — Zod + typed `ERROR_CODES`
- 0007 UI & design system — shadcn/ui + Tailwind tokens (no hex literals)
- 0008 Attachment ID nullable

Phase 2 (`specs/002-smart-forms/adr/`):
- 0009 Category schema storage
- 0010 Answer storage & label snapshot
- 0011 Dynamic Zod validation
- 0012 Field type taxonomy

Phase 3 (`specs/003-idea-listing-management/adr/`):
- 0013 Edit/delete cut-off & audit policy
- 0014 Shared listing query design
- 0015 Edit audit marker (`from = to` row)
- 0016 Streaming CSV export

---

## 4. Test Coverage

**Overall coverage** (from [project/coverage/index.html](project/coverage/index.html)):

| Metric | Coverage | Raw |
| --- | --- | --- |
| Statements | **78.76%** | 1506 / 1912 |
| Branches | **81.61%** | 222 / 272 |
| Functions | **84%** | 63 / 75 |
| Lines | **78.76%** | 1506 / 1912 |

Constitution gate requires ≥70% line coverage on `src/server/**` + `src/lib/**` — met.

**Test inventory**:

- **Unit tests (Vitest, 4 files)** in `tests/unit/`:
  - `lib/errors/codes.smart-forms.test.ts`
  - `lib/validation/category-fields.test.ts`
  - `server/category-answers.test.ts`
  - `server/category-schema.test.ts`
- **Integration tests (Vitest, 9 files)** in `tests/integration/` — fresh SQLite per run:
  - `attachment-service`, `auth.register`, `categories.decisions`, `idea-answers`, `idea-service`, `transitions`, `users.role`
  - `security/audit-log`, `security/csrf`
- **E2E tests (Playwright, 4 specs)** in `tests/e2e/` with axe accessibility assertions:
  - `submit-idea`, `reviewer-approve`, `admin-categories`, `admin-users`

**Total: 13 Vitest test files + 4 Playwright specs.**

CI also enforces: every `ERROR_CODES` entry exercised by ≥1 test, no raw hex/rgb literals in UI, Prettier/ESLint/`tsc --noEmit` clean, Drizzle migrations + seed run cleanly.

---

## 5. Project Structure Highlights

```
content/                           Course brief & deliverable templates
project/
├── src/
│   ├── app/                       Next.js App Router (route groups by role)
│   │   ├── (public)/              login, register
│   │   ├── (employee)/            my-ideas, ideas/new, ideas/[id]
│   │   ├── (reviewer)/queue
│   │   ├── (admin)/admin/        users, categories
│   │   └── api/                  REST routes (auth, ideas, categories, attachments, users)
│   ├── components/               ui/ primitives, forms/, ideas/, admin/, layout/
│   ├── db/                       Drizzle schema, client, migrate, seed, repositories
│   ├── lib/                      validation (zod), errors (typed codes), format, hooks, utils
│   ├── server/                   services, idea-state-machine, auth-options, infra
│   ├── instrumentation.ts        Next.js instrumentation (bootstrap admin)
│   └── middleware.ts             Auth/role middleware
├── tests/                        unit / integration / e2e + helpers
├── drizzle/                      Generated migrations (immutable)
├── scripts/                      check-error-codes, check-ui-tokens, seed-admin, install-hooks
├── specs/
│   ├── 001-innovatepam-portal-mvp/   spec, plan, tasks, data-model, research, quickstart, adr/, contracts/openapi.yaml
│   └── 002-smart-forms/              same shape, adr/, checklists/
├── coverage/                     Generated v8 coverage HTML report
├── data/uploads/                 Runtime attachment storage
└── package.json, drizzle.config.ts, playwright.config.ts, vitest.config.ts, tailwind.config.ts
```

---

## 6. Workflow — Idea Lifecycle (State Machine)

Source: [project/src/server/idea-state-machine.ts](project/src/server/idea-state-machine.ts)

**States**: `SUBMITTED` → `UNDER_REVIEW` → `APPROVED` / `REJECTED` → `IMPLEMENTED`

**Transition rules**:

| Action | From | To | Roles | Comment required |
| --- | --- | --- | --- | --- |
| `START_REVIEW` | `SUBMITTED` | `UNDER_REVIEW` | EVALUATOR, ADMIN | no |
| `APPROVE` | `SUBMITTED`, `UNDER_REVIEW` | `APPROVED` | EVALUATOR, ADMIN | **yes** |
| `REJECT` | `SUBMITTED`, `UNDER_REVIEW` | `REJECTED` | EVALUATOR, ADMIN | **yes** |
| `IMPLEMENT` | `APPROVED` | `IMPLEMENTED` | **ADMIN only** | no |

**Cross-cutting guards** (deny reasons, in order):

1. `AUTH_FORBIDDEN_ROLE` — actor's role not in `allowedRoles`.
2. `IDEA_SELF_EVALUATION_FORBIDDEN` — actor is the idea's author.
3. `IDEA_CATEGORY_PENDING` — idea's category is in `PROPOSED` state.
4. `IDEA_ALREADY_DECIDED` — approve/reject attempted on already decided idea.
5. `IDEA_INVALID_TRANSITION` — any other illegal `from`-state.
6. `IDEA_COMMENT_REQUIRED` — required comment missing/blank.

The evaluator is a **pure function** with no DB or Node-only APIs — used both by the API (defense-in-depth inside the DB transaction) and by the UI (button gating via `canTransition`). Every accepted transition is appended to the `status_transitions` audit table.

**Category lifecycle** (separate, supporting): `PROPOSED` → (admin decision) → `ACTIVE` or `REJECTED`. Ideas under a `REJECTED` category are re-linked to the protected `Other` category. Reviewers cannot decide on an idea while its category is `PROPOSED`.

---

## 7. Screenshots

Captured against a freshly-seeded local DB (`scripts/seed-demo.ts`) by `scripts/capture-screenshots.ts` running Playwright against `npm run dev`.

| # | File | Flow |
| --- | --- | --- |
| 01 | [screenshots/01-login.png](screenshots/01-login.png) | Public — sign in |
| 02 | [screenshots/02-register.png](screenshots/02-register.png) | Public — register |
| 03 | [screenshots/03-employee-my-ideas.png](screenshots/03-employee-my-ideas.png) | Employee — My Ideas list |
| 04 | [screenshots/04-employee-new-idea-empty.png](screenshots/04-employee-new-idea-empty.png) | Employee — empty submission form |
| 05 | [screenshots/05-employee-new-idea-dynamic-fields.png](screenshots/05-employee-new-idea-dynamic-fields.png) | Employee — dynamic fields appear after picking a category (Phase 2) |
| 06 | [screenshots/06-employee-idea-detail.png](screenshots/06-employee-idea-detail.png) | Employee — idea detail with structured answers |
| 07 | [screenshots/07-reviewer-queue.png](screenshots/07-reviewer-queue.png) | Reviewer — queue |
| 08 | [screenshots/08-reviewer-idea-detail.png](screenshots/08-reviewer-idea-detail.png) | Reviewer — idea detail with action buttons |
| 09 | [screenshots/09-admin-users.png](screenshots/09-admin-users.png) | Admin — user role management |
| 10 | [screenshots/10-admin-categories.png](screenshots/10-admin-categories.png) | Admin — proposed + active categories |
| 11 | [screenshots/11-admin-category-schema.png](screenshots/11-admin-category-schema.png) | Admin — per-category schema editor |

**Reproduce locally** (PowerShell):

```powershell
cd project
npm run db:reset; npm run db:migrate; npm run db:seed
$env:BOOTSTRAP_ADMIN_EMAIL="admin@innovatepam.test"
$env:BOOTSTRAP_ADMIN_PASSWORD="Passw0rd!2024"
npm run db:seed:admin
npx tsx scripts/seed-demo.ts
$env:NEXTAUTH_SECRET="dev-secret"; $env:AUTH_SECRET="dev-secret"
$env:NEXTAUTH_URL="http://localhost:3000"; $env:AUTH_URL="http://localhost:3000"
npm run dev          # in one terminal
npx tsx scripts/capture-screenshots.ts   # in another, once dev is ready
```

Demo accounts (all password `Passw0rd!2024`):

- `admin@innovatepam.test` — ADMIN
- `evaluator@innovatepam.test` — EVALUATOR
- `employee@innovatepam.test` — EMPLOYEE (owns the 3 seeded ideas)

---

## 8. Presentation

[PRESENTATION.html](PRESENTATION.html) — 22-slide Reveal.js deck (loads Reveal.js from a CDN; just open the file in a browser). Uses the screenshots above; press <kbd>S</kbd> for speaker notes, <kbd>F</kbd> for fullscreen.
