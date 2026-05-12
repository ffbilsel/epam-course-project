# InnovatePAM Portal — MVP

A small-org idea-management portal: employees submit, evaluators review,
admins govern users and categories. Local-first stack, fully offline-
runnable from a clean checkout.

> Workspace layout: this `project/` folder contains the running app.
> Specifications live in [specs/001-innovatepam-portal-mvp/](specs/001-innovatepam-portal-mvp/).

## Stack

- **Next.js 14 (App Router, RSC-first)** — see
  [ADR-0001](specs/001-innovatepam-portal-mvp/adr/0001-rendering-and-framework.md)
- **TypeScript 5 strict** — `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride`,
  `noImplicitReturns`
- **SQLite + Drizzle ORM** —
  [ADR-0002](specs/001-innovatepam-portal-mvp/adr/0002-storage-and-orm.md)
- **NextAuth (Credentials + DrizzleAdapter, DB sessions)** —
  [ADR-0003](specs/001-innovatepam-portal-mvp/adr/0003-authentication.md)
- **Pure-function state machine for idea transitions** —
  [ADR-0004](specs/001-innovatepam-portal-mvp/adr/0004-state-machine.md)
- **Local-disk staged attachments** —
  [ADR-0005](specs/001-innovatepam-portal-mvp/adr/0005-attachment-storage.md)
- **Zod + typed `ERROR_CODES` registry** —
  [ADR-0006](specs/001-innovatepam-portal-mvp/adr/0006-validation-and-errors.md)
- **shadcn/ui + Tailwind tokens (no hex literals)** —
  [ADR-0007](specs/001-innovatepam-portal-mvp/adr/0007-ui-and-design-system.md)

## Quick start

```powershell
# 1. From the project/ folder
npm install

# 2. Configure environment (PowerShell example)
$env:NEXTAUTH_SECRET = "dev-secret-change-me"
$env:DATABASE_URL    = "file:./data/innovatepam.db"
$env:BOOTSTRAP_ADMIN_EMAIL = "you@yourorg.test"

# 3. Apply migrations + seed reference data (5 categories incl. protected "Other")
npm run db:migrate
npm run db:seed

# 4. Run dev server
npm run dev
# open http://localhost:3000
```

The first user who registers with the email matching
`BOOTSTRAP_ADMIN_EMAIL` is promoted to `ADMIN`; the marker is then
consumed (one-shot, audited).

For end-to-end walkthroughs, see
[specs/001-innovatepam-portal-mvp/quickstart.md](specs/001-innovatepam-portal-mvp/quickstart.md).

## Scripts

| Command                     | Purpose                                              |
| --------------------------- | ---------------------------------------------------- |
| `npm run dev`               | Next.js dev server                                   |
| `npm run build` / `start`   | Production build / serve                             |
| `npm run typecheck`         | `tsc --noEmit` (strict)                              |
| `npm run lint`              | Next/ESLint + jsx-a11y + jsdoc                       |
| `npm run format`            | Prettier check (run `npx prettier --write .` to fix) |
| `npx vitest run --coverage` | Unit + integration with v8 coverage                  |
| `npm run test:e2e`          | Playwright E2E (Chromium/Firefox/WebKit)             |
| `npm run check:error-codes` | Every `ERROR_CODES` entry must be tested             |
| `npm run check:ui-tokens`   | No raw hex/rgb literals outside primitives           |
| `npm run db:generate`       | Generate a new Drizzle migration                     |
| `npm run db:migrate`        | Apply migrations                                     |
| `npm run db:seed`           | Seed/refresh default categories                      |

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
│   ├── app/              # Next.js App Router (RSC + route handlers)
│   ├── components/       # ui/ primitives + forms/ + ideas/ + admin/
│   ├── db/               # Drizzle schema, client, repositories, seed
│   ├── lib/              # validation (zod), errors, format, hooks
│   └── server/           # services, state machine, auth, infra
├── tests/
│   ├── e2e/              # Playwright + axe
│   └── integration/      # Vitest integration (fresh SQLite per run)
├── drizzle/              # Generated migrations (immutable)
├── scripts/              # check:error-codes, check:ui-tokens
└── .github/workflows/    # CI

specs/001-innovatepam-portal-mvp/
├── spec.md, plan.md, tasks.md, data-model.md, research.md, quickstart.md
├── adr/                  # 0001..0007
└── contracts/openapi.yaml
```

## Contributing

Open a PR — the
[pull-request template](.github/pull_request_template.md) walks through
all ten constitution gates. Feature branches merge back to `main` with
`git merge --no-ff` so the feature boundary stays visible.
