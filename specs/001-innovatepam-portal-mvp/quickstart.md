# Quickstart — InnovatEPAM Portal MVP

Run, test, and seed the portal locally. All commands assume `cwd =
project/`.

## 1. Prerequisites

- **Node.js**: `>=20 <21` (`node --version` to confirm).
- **npm**: bundled with Node 20.
- **Git**: latest stable.
- **Disk**: ~250 MB for `node_modules`, plus space for `./data/`.
- **Browsers** (E2E): Playwright will download Chromium, Firefox,
  WebKit on first run.

## 2. Initial setup

```bash
# Install dependencies
npm ci

# Copy env template and fill in
cp .env.example .env.local
# At minimum, set:
#   NEXTAUTH_SECRET=<paste 32+ random bytes, base64>
#   BOOTSTRAP_ADMIN_EMAIL=admin@example.com
#   DATABASE_URL=file:./data/innovatepam.db   # (default)

# Apply migrations (creates ./data/innovatepam.db)
npm run db:migrate

# Seed the categories + bootstrap-admin marker
npm run db:seed

# Install Playwright browsers (first time only)
npx playwright install --with-deps
```

After `db:seed`:

- 5 categories exist: Process Improvement, Product Innovation,
  Tooling, Customer Experience, Other (`Other` is `isProtected = 1`).
- A bootstrap-admin marker is recorded for `BOOTSTRAP_ADMIN_EMAIL`. The
  next user who registers with that email is promoted to ADMIN on
  account create. If the user already exists, they are promoted
  immediately.

## 3. Daily commands

| Purpose | Command |
|---|---|
| Start dev server | `npm run dev` (then http://localhost:3000) |
| Build production | `npm run build && npm start` |
| Type-check | `npm run typecheck` |
| Lint | `npm run lint` |
| Format check | `npm run format` |
| Format fix | `npm run format:write` |
| Run unit tests | `npm run test:unit` |
| Run integration tests | `npm run test:integration` |
| Run E2E tests | `npm run test:e2e` |
| Run all tests + coverage | `npm test -- --coverage` |
| Local pre-merge sweep | `npm run check` (= typecheck + lint + format + test:unit) |
| Generate new migration | `npm run db:generate -- --name <name>` |
| Apply migrations | `npm run db:migrate` |
| Re-seed | `npm run db:seed` |
| Drop dev DB | `npm run db:reset` (deletes `./data/innovatepam.db`) |
| Check error-code registry (gate #9) | `npm run check:error-codes` |
| Check UI tokens (gate #9) | `npm run check:ui-tokens` |

## 4. First end-to-end smoke

After `npm run dev`:

1. Browse to http://localhost:3000 → redirected to **/login**.
2. Click **Register**. Use `BOOTSTRAP_ADMIN_EMAIL` and a password
   meeting the policy (≥ 8 chars, one letter + one digit). On
   success you're routed to **My Ideas**.
3. Log out and log back in — landing page is now **Review queue**
   (you were promoted to ADMIN on registration via FR-005b).
4. Register a second account with a different email — it lands on
   **My Ideas** as an EMPLOYEE.
5. As the EMPLOYEE, **Submit Idea**: title, description, pick a
   category from the dropdown, optionally upload a PDF, submit.
6. Switch back to the ADMIN account, open **Review queue**, pick the
   idea, click **Start review**, then **Approve** with a comment.
7. With the idea now `APPROVED`, click **Mark as implemented** on the
   detail page.
8. Switch to the EMPLOYEE — the idea now shows `IMPLEMENTED` with the
   reviewer's comment in the timeline.

## 5. Repository layout (recap)

See [./plan.md](./plan.md) → "Source Code (repository root)" for the
full tree. Highlights:

- `src/app/**` — UI routes & API handlers.
- `src/server/**` — domain logic (gated to ≥ 70% coverage).
- `src/db/**` — Drizzle schema + repositories + seed.
- `src/lib/errors/**` — single error-code registry + `AppError` +
  `withErrorHandler`.
- `tests/{unit,integration,e2e}/**` — three test tiers.
- `specs/001-innovatepam-portal-mvp/**` — spec, plan, contracts,
  this file.

## 6. Gotchas

- **Windows path length**: keep the repo close to drive root if you
  hit `ENAMETOOLONG` during `npm ci`.
- **First Playwright run** downloads ~300 MB of browsers; subsequent
  runs are cached.
- **`./data/` is gitignored** but the directory itself must exist
  before `npm run db:migrate` (the migrate script creates it
  defensively).
- **Sliding session**: editing a long form may still expire the
  session if no other request is made for 24 h. The form is
  preserved in `localStorage` and resumed after re-login.
- **Bootstrap admin re-seed**: after the first ADMIN exists,
  changing `BOOTSTRAP_ADMIN_EMAIL` is a no-op. Promote/demote via the
  Admin → Users page.

## 7. CI parity

CI runs the exact same commands listed in §3 in this order
(per Constitution V.8):

```text
npm ci
npm run typecheck
npm run lint
npm run format
npm run test:unit -- --coverage
npm run test:integration
npm run test:e2e
npm run check:error-codes
npm run check:ui-tokens
```

Gate #4 (coverage), Gate #8 (a11y / responsiveness) and Gate #9
(consistency) are enforced in steps 5, 7, and 8–9 respectively.
