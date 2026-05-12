# InnovatePAM Portal

A small-org idea-management portal: employees submit, evaluators
review, admins govern users, categories, and per-category form
schemas. Local-first stack — clones, installs, and runs fully offline
from a clean checkout.

> Workspace layout: this `project/` folder contains the running app.
> Specs live in `specs/`:
>
> - Phase 1 MVP — [001-innovatepam-portal-mvp](specs/001-innovatepam-portal-mvp/)
> - Phase 2 Smart Forms — [002-smart-forms](specs/002-smart-forms/)
>
> A presentation-ready overview lives in
> [../PROJECT_SUMMARY.md](../PROJECT_SUMMARY.md).

## Stack

- **Next.js 14** (App Router, RSC-first) —
  [ADR-0001](specs/001-innovatepam-portal-mvp/adr/0001-rendering-and-framework.md)
- **TypeScript 5 strict** — `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noImplicitReturns`
- **SQLite + Drizzle ORM** —
  [ADR-0002](specs/001-innovatepam-portal-mvp/adr/0002-storage-and-orm.md)
- **NextAuth v5 (Credentials + DrizzleAdapter, DB sessions)** —
  [ADR-0003](specs/001-innovatepam-portal-mvp/adr/0003-authentication.md)
- **Pure-function state machine** for idea transitions —
  [ADR-0004](specs/001-innovatepam-portal-mvp/adr/0004-state-machine.md)
- **Local-disk staged attachments** with magic-number sniffing —
  [ADR-0005](specs/001-innovatepam-portal-mvp/adr/0005-attachment-storage.md)
- **Zod + typed `ERROR_CODES` registry** —
  [ADR-0006](specs/001-innovatepam-portal-mvp/adr/0006-validation-and-errors.md)
- **shadcn/ui + Tailwind tokens** (no hex literals) —
  [ADR-0007](specs/001-innovatepam-portal-mvp/adr/0007-ui-and-design-system.md)
- **Smart submission forms (Phase 2)** — admin-defined per-category
  field schemas with runtime Zod validation and label snapshots. See
  ADRs
  [0009](specs/002-smart-forms/adr/0009-category-schema-storage.md),
  [0010](specs/002-smart-forms/adr/0010-answer-storage-and-label-snapshot.md),
  [0011](specs/002-smart-forms/adr/0011-dynamic-zod-validation.md),
  [0012](specs/002-smart-forms/adr/0012-field-type-taxonomy.md).

## Quick start

Requires **Node 20.x** (see `engines` in `package.json`).

```powershell
# 1. From the project/ folder
npm install

# 2. Configure environment (PowerShell example)
$env:NEXTAUTH_SECRET       = "dev-secret-change-me"
$env:AUTH_SECRET           = "dev-secret-change-me"
$env:NEXTAUTH_URL          = "http://localhost:3000"
$env:AUTH_URL              = "http://localhost:3000"
$env:DATABASE_URL          = "file:./data/innovatepam.db"
$env:BOOTSTRAP_ADMIN_EMAIL = "you@yourorg.test"

# 3. Apply migrations + seed reference data
#    (5 categories incl. protected "Other")
npm run db:migrate
npm run db:seed

# 4. (Optional) Bootstrap an admin account from env vars
$env:BOOTSTRAP_ADMIN_PASSWORD = "Passw0rd!2024"
npm run db:seed:admin

# 5. Run the dev server
npm run dev
# open http://localhost:3000
```

The first user who registers (or is seeded) with the email matching
`BOOTSTRAP_ADMIN_EMAIL` is promoted to `ADMIN`; the marker is then
consumed (one-shot, audited).

For end-to-end walkthroughs, see
[specs/001-innovatepam-portal-mvp/quickstart.md](specs/001-innovatepam-portal-mvp/quickstart.md)
and
[specs/002-smart-forms/quickstart.md](specs/002-smart-forms/quickstart.md).

## Scripts

| Command                     | Purpose                                             |
| --------------------------- | --------------------------------------------------- |
| `npm run dev`               | Next.js dev server                                  |
| `npm run build` / `start`   | Production build / serve                            |
| `npm run typecheck`         | `tsc --noEmit` (strict)                             |
| `npm run lint`              | Next/ESLint + jsx-a11y + jsdoc                      |
| `npm run format`            | Prettier check                                      |
| `npm run format:write`      | Prettier write                                      |
| `npm test`                  | All Vitest projects                                 |
| `npm run test:unit`         | Vitest unit project only                            |
| `npm run test:integration`  | Vitest integration project (fresh SQLite per run)   |
| `npm run test:e2e`          | Playwright E2E (Chromium / Firefox / WebKit) + axe  |
| `npx vitest run --coverage` | Unit + integration with v8 coverage                 |
| `npm run check:error-codes` | Every `ERROR_CODES` entry must be tested            |
| `npm run check:ui-tokens`   | No raw hex/rgb literals outside primitives          |
| `npm run check`             | typecheck + lint + format + unit (pre-PR aggregate) |
| `npm run db:generate`       | Generate a new Drizzle migration                    |
| `npm run db:migrate`        | Apply migrations                                    |
| `npm run db:seed`           | Seed/refresh default categories                     |
| `npm run db:seed:admin`     | Seed admin from `BOOTSTRAP_ADMIN_*` env vars        |
| `npm run db:reset`          | Delete the local SQLite file                        |
| `npm run setup:hooks`       | Install repo Git hooks (PowerShell)                 |

## Quality gates

The CI pipeline (`.github/workflows/ci.yml`) enforces, in order:

1. Prettier ✓ → ESLint ✓ → `tsc --noEmit` ✓
2. Drizzle migrations + seed run cleanly
3. Vitest unit + integration with ≥ 70% line coverage on
   `src/server/**` + `src/lib/**`
4. `check:error-codes` — every code is exercised by ≥ 1 test
5. `check:ui-tokens` — design-token discipline
6. Playwright E2E (4 happy-path specs, axe-clean assertions)

See the [project constitution](../.specify/memory/constitution.md) for
the ten principles these gates encode.

## Repository map

```
project/
├── src/
│   ├── app/              # Next.js App Router
│   │   ├── (public)/     # login, register
│   │   ├── (employee)/   # ideas/new, ideas/[id], my-ideas
│   │   ├── (reviewer)/   # queue
│   │   ├── (admin)/      # admin/users, admin/categories
│   │   └── api/          # auth, attachments, categories, ideas, users
│   ├── components/       # ui/ primitives + forms/ + ideas/ + admin/ + layout/
│   ├── db/               # Drizzle schema, client, repositories, seed, migrate
│   ├── lib/              # validation (zod), errors, format, hooks
│   └── server/           # services, state machine, auth, infra (rate-limit, logger)
├── tests/
│   ├── unit/             # Vitest unit
│   ├── integration/      # Vitest integration (fresh SQLite per run)
│   └── e2e/              # Playwright + axe
├── drizzle/              # Generated migrations (immutable) + meta snapshots
├── scripts/              # check:error-codes, check:ui-tokens, seed-admin, hooks
├── data/uploads/         # Local-disk attachment storage (gitignored content)
├── coverage/             # v8 coverage report (HTML + lcov)
└── .github/workflows/    # CI

specs/
├── 001-innovatepam-portal-mvp/
│   ├── spec.md, plan.md, tasks.md, data-model.md, research.md, quickstart.md
│   ├── adr/                  # 0001..0008
│   └── contracts/openapi.yaml
└── 002-smart-forms/
    ├── spec.md, plan.md, tasks.md, data-model.md, research.md, quickstart.md
    ├── adr/                  # 0009..0012
    ├── checklists/
    └── contracts/
```

## Contributing

Open a PR — the
[pull-request template](.github/pull_request_template.md) walks
through all ten constitution gates. Feature branches merge back to
`main` with `git merge --no-ff` so the feature boundary stays
visible.
