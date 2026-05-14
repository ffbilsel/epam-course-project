# Quickstart — Phase 5 (Attachments, Version History & Notifications)

**Branch**: `005-attachments-history-notifications`
**Spec**: [./spec.md](./spec.md) · **Plan**: [./plan.md](./plan.md)

This walks through what an engineer (or the agent) does locally to
implement, run, and verify Phase 5 on top of an existing Phase 1–4
checkout.

## 1. Prerequisites

Same as Phase 4, plus:

- Node.js 20.x, npm 10.x.
- A working clone of the repo on branch
  `005-attachments-history-notifications`.
- `.env` already populated for Phase 1–4
  (`DATABASE_URL`, `NEXTAUTH_SECRET`, `UPLOAD_ROOT`).
- **Phase-5 SMTP settings** in `.env`:

  ```env
  SMTP_HOST=localhost
  SMTP_PORT=1025
  SMTP_USER=
  SMTP_PASSWORD=
  SMTP_SECURE=false
  MAIL_FROM="InnovatEPAM Portal <no-reply@portal.local>"
  ```

  For local development run a captive SMTP sink such as
  [Mailpit](https://github.com/axllent/mailpit) on `:1025` (web UI on
  `:8025`). The repository does **not** ship a Mailpit container —
  use whatever local SMTP captor you prefer.

## 2. Install + migrate

```pwsh
npm install           # installs the two new deps: nodemailer ^6.9, diff ^5.2
npm run db:migrate    # applies drizzle/0004_attachments_history_notifications.sql
                      # AND runs the TypeScript back-fill step in migrate.ts
```

The migration:

- DROPs `uniq_attachments_idea` and ADDs `attachments.display_order`
  + `idx_attachments_idea_order`.
- Creates `idea_versions`, `notification_events`, `email_deliveries`,
  `email_preferences`.
- Back-fills `v1` for every existing idea and walks Phase-3 `EDITED`
  audit rows to produce subsequent snapshots.

To verify after migrate:

```pwsh
sqlite3 data/portal.sqlite ".schema idea_versions"
sqlite3 data/portal.sqlite ".schema notification_events"
sqlite3 data/portal.sqlite ".indexes attachments"
sqlite3 data/portal.sqlite "SELECT version_no, COUNT(*) FROM idea_versions GROUP BY version_no;"
```

## 3. Seed sample data (recommended)

```pwsh
npm run db:seed:demo
```

The demo seed gains:

- Two existing ideas extended with three attachments each (a PNG, a
  PDF, a `.md`) so the gallery and preview surfaces are exercised on
  first load.
- One idea edited four times to populate `v1..v5` for the diff
  viewer.
- A handful of pre-baked notification events for the seeded users so
  the badge is non-empty at the first render.

## 4. Run the dev server + worker

```pwsh
npm run dev
```

`src/instrumentation.ts` starts the `notification-poller` on boot;
nothing extra to launch. Watch Mailpit's web UI at
`http://localhost:8025` to see emails as they leave the queue.

Hit each surface manually:

| URL                                       | Story / FR              | Expected                                                                                       |
|-------------------------------------------|-------------------------|------------------------------------------------------------------------------------------------|
| `/ideas/new` → drop 3 files               | 1 / FR-001..005          | Per-file progress; three preview cards; "Save" persists all three with stable order            |
| `/ideas/<id>` (gallery)                   | 1 / FR-003               | Image inline; PDF in `<iframe>`; `.md` rendered safely; `.zip` shows download card             |
| `/ideas/<id>` → open preview              | 1 / NFR-006              | Sandboxed `<iframe>`; CSP headers visible in DevTools; no parent-origin access from iframe     |
| `/ideas/<id>` (own draft) edit + save     | 3 / FR-020               | New row in `idea_versions`; version_no increments; tab "Versions" shows v1..vN                 |
| `/ideas/<id>` → Versions → Compare        | 3 / FR-023..024          | Side-by-side diff; word-level highlights; unchanged fields collapsed                           |
| Theme toggle (top nav) while diff is open | 4 / FR-033               | Diff red/green re-themes live; no reload                                                       |
| Sign in as a non-author reviewer          | 2 / FR-012               | Status change on a watched idea triggers an email + badge increment within ~60 s               |
| Top-nav bell badge                        | 2 / FR-015               | Badge polls every 60 s; pauses when tab is hidden; clicking marks-read                         |
| `/account/preferences` toggle "Status"    | 2 / FR-014               | Subsequent status change produces a badge entry but no mail                                    |
| Anonymous-category idea, reviewer mail    | 2 / FR-013               | Submitter identity absent from subject, body, `From` header (uses generic system identity)     |

## 5. Run the test suites

```pwsh
npm run lint
npm run typecheck
npm test                   # unit + integration (Vitest)
npm run test:e2e           # Playwright + axe
npm run format -- --check
npm run check:error-codes
npm run check:ui-tokens
```

New test files added in Phase 5:

- **Unit** (`tests/unit/`):
  - `server/notification-service.test.ts`
  - `server/email-dispatcher.test.ts` — fake transport; asserts
    retry schedule, suppression, anonymity redaction.
  - `server/email-preference-service.test.ts`
  - `server/version-service.test.ts`
  - `server/diff-service.test.ts`
  - `server/attachment-service.test.ts` — extended for multi /
    reorder / quota.
  - `lib/format/diff-snippet.test.ts`
  - `lib/format/plain-text-markdown.test.ts`
  - `lib/validation/{attachment,notification,version,email-preference}.test.ts`

- **Integration** (`tests/integration/`):
  - `attachments-multi-upload.test.ts`
  - `attachment-preview-headers.test.ts`
  - `idea-versions-snapshot-on-edit.test.ts`
  - `idea-versions-diff.test.ts`
  - `notifications-fanout.test.ts` (per-event-kind + bulk digest)
  - `notifications-anonymity.test.ts` (FR-013 contract)
  - `email-preferences-suppress.test.ts`
  - `notifications-badge-poll.test.ts`

- **E2E** (`tests/e2e/`):
  - `employee-multi-attachment-and-preview.spec.ts`
  - `reviewer-receives-email-and-badge.spec.ts`
  - `author-compares-idea-versions.spec.ts`

E2E specs run with the `notification-poller` interval reduced to
~250 ms via the env var `NOTIFICATION_POLL_INTERVAL_MS` so a test
does not have to sleep 60 s. The fake email transport records sent
messages in memory; specs assert on the recorded queue, not on real
SMTP.

## 6. Performance smoke

To confirm NFR-001 / NFR-002 on the baseline machine:

```pwsh
# 1) Stress the diff endpoint with a 200KB description
npm run perf:diff

# 2) Time a batch of 100 notification events through the worker
npm run perf:notifications

# 3) Time a 5 MB PDF preview response
curl -sS -o /dev/null -w "%{time_starttransfer}\n" \
  http://localhost:3000/api/attachments/<id>/preview
```

Both perf scripts live under `scripts/perf/` and pass on the
baseline target referenced in Phase-1 plan.

## 7. Merge to `main`

Once `/speckit.implement` reports green and all Quality Gates 1–11
pass on the feature-branch HEAD, the final task performs:

```pwsh
git checkout main
git merge --no-ff 005-attachments-history-notifications -m "merge(feature/005): attachments, version history & notifications"
git push origin main
```

This is Quality Gate #12 (feature merge-back) and closes the SpecKit
lifecycle for this feature.
