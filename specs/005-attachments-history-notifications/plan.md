# Implementation Plan: Attachments, Version History & Notifications (Phase 5)

**Branch**: `005-attachments-history-notifications` | **Date**: 2026-05-14 |
**Spec**: [./spec.md](./spec.md)
**Input**: Feature specification from
`/specs/005-attachments-history-notifications/spec.md`

## Summary

Phase 5 closes the three structural gaps identified in the spec —
"the portal is silent", "attachments are anaemic", and "edit history
is opaque" — with four coordinated capabilities that ride on top of
Phase 1–4 without re-opening the idea state machine, the role model,
the anonymity model (ADR-0018), or the design-token system
(ADR-0022):

1. **Multiple attachments per idea with in-portal preview** (Story 1,
   P1). The Phase-1 unique-index on `attachments(idea_id)` is dropped;
   each idea now carries 1..10 ordered attachments (25 MB each /
   100 MB total). Preview is browser-native — `<img>` for images,
   `<iframe>` for PDF and plain-text/markdown — wrapped in a sandboxed
   `<iframe sandbox>` and gated by a `Content-Disposition: inline`
   response with a `Content-Security-Policy: sandbox` header. Anything
   the browser cannot render natively (`.docx`, `.pptx`, `.zip`, …)
   degrades to a download card. **No new client preview library** —
   the simplest thing that satisfies FR-003 and NFR-006 (ADR-0025).
2. **Transactional email + in-app notifications** (Story 2, P1).
   Outbound mail is delivered by `nodemailer ^6.9` over the operator-
   configured SMTP relay (env-driven). Send happens in a worker
   triggered by an in-process queue table (`notification_events`)
   *after* the originating domain transaction commits, so a failed
   send NEVER rolls back the underlying state change / comment /
   rating (NFR-003, FR-016, ADR-0023). The same `notification_events`
   row powers an in-app badge polled every **60 s** by an `AppShell`-
   level hook (ADR-0026). Per-user preferences live in a new
   `email_preferences` table; bulk Admin transitions are collapsed
   into a per-recipient digest (FR-017).
3. **Versioned edit history with diff viewer** (Story 3, P2). Every
   author edit emits a snapshot row in a new `idea_versions` table
   (title, description, category id, structured answers JSON,
   attachment-id list). The diff endpoint hydrates two snapshots and
   returns a per-field diff computed by the `diff ^5.2` npm package
   (`diffWordsWithSpace` for prose; `diffArrays` for the attachment
   id list; opaque "before → after" for structured / non-text answers).
   The UI renders side-by-side by default, unified on toggle, with
   unchanged fields collapsed (FR-023..024, ADR-0024). Phase-3
   `status_transitions(kind = 'EDITED')` audit rows are back-filled
   into `idea_versions` at migration time so the history list is
   coherent for legacy ideas (Assumption ▸ Migration).
4. **Dark-mode coverage of every new surface** (woven into 1–3, not a
   separate story). Each new component (`AttachmentManager`,
   `AttachmentPreview`, `VersionTimeline`, `DiffViewer`,
   `EmailPreferencesPage`, `NotificationBadge`,
   `NotificationDropdown`) consumes the ADR-0022 CSS-variable tokens;
   diff red/green highlights are token-driven so they re-theme
   live on theme switch (FR-030..033, SC-006).

No new role; no change to the `IdeaStatus` grammar; no change to the
anonymity model; no new third-party SaaS. One new runtime dep
(`nodemailer`), one new build-and-runtime dep (`diff`).

## Technical Context

**Language/Version**: TypeScript `~5.4` (strict mode, unchanged from
Phase 1–4); Node.js `>=20 <21`.

**Primary Dependencies**: unchanged from Phase 4 — Next.js 14 (App
Router), React 18, Tailwind CSS, shadcn/ui, Zod, React Hook Form +
`@hookform/resolvers/zod`, NextAuth v5 + Drizzle adapter, Drizzle ORM
+ `better-sqlite3`, `date-fns`, `lucide-react`,
`class-variance-authority`, `sonner`, `recharts`. **Two new runtime
dependencies**:

- **`nodemailer ^6.9`** — SMTP transport for transactional mail.
  Talks to the operator-configured SMTP relay via env vars
  (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
  `SMTP_SECURE`, `MAIL_FROM`). Replaceable at the
  `src/server/infra/email-transport.ts` boundary so unit tests inject
  a fake transport that records messages in memory (ADR-0023).
- **`diff ^5.2`** — pure-JS diff implementation. Used server-side by
  the diff endpoint (which returns a per-field hunk array) and
  client-side only for re-renderable diff selection (no re-computation
  on the client by default — the server is the oracle) (ADR-0024).

Preview is browser-native — **no new client preview library**: images
via `<img>`, PDF and text/markdown via a sandboxed `<iframe>` against
`/api/attachments/[id]/preview` with `Content-Disposition: inline`,
`Content-Security-Policy: sandbox`, and a hardened
`X-Content-Type-Options: nosniff`. Markdown is rendered server-side
to HTML via the **already-vetted** plain-text-and-linebreak escaper
from Phase 4 (`src/lib/format/plain-text.ts`) extended with a
**bounded** set of safe tags (`<h1..h6>`, `<p>`, `<ul>/<ol>/<li>`,
`<code>`, `<pre>`, `<a rel="noopener noreferrer" target="_blank">`,
`<strong>`, `<em>`, line-breaks) — no `<script>`, no `<img src=…>`
auto-fetch, no `on*` handlers; SVG previews always render through the
download-card fallback because sanitising arbitrary SVG is out of
scope for this phase (Assumption ▸ Preview safety; ADR-0025).

**Storage**: SQLite via `better-sqlite3`. **Schema delta** (Drizzle
migration `drizzle/0004_attachments_history_notifications.sql`):

1. **`attachments` modifications** —
   - DROP `uniq_attachments_idea` (the single-attachment uniqueness
     introduced in Phase 1).
   - ADD `display_order INTEGER NOT NULL DEFAULT 0`.
   - ADD `idx_attachments_idea_order` on `(idea_id, display_order)`.
   - Migrate legacy rows by setting `display_order = 0` (each idea
     already has at most one row, so position 0 is correct).
2. **New table `idea_versions`** — append-only snapshot per author
   edit. Columns: `id`, `idea_id`, `version_no` (1..N, unique per
   idea), `actor_id`, `created_at`, `title`, `description`,
   `category_id`, `category_answers` (JSON), `attachment_ids` (JSON
   array of attachment ids in display order). Foreign key on
   `idea_id ON DELETE CASCADE` so NFR-004 holds. Unique index on
   `(idea_id, version_no)`. Insert is performed inside the same
   transaction as the underlying edit (or initial submit for
   `version_no = 1`).
3. **New table `notification_events`** — one row per in-system event
   (status-change / comment-added / rating-added / reply-on-review /
   bulk-digest). Columns: `id`, `recipient_id`, `actor_id NULL`
   (NULL = system), `idea_id NULL` (NULL for bulk-digests),
   `kind` (`'STATUS_CHANGED' | 'COMMENT_ADDED' | 'RATING_ADDED' |
   'REPLY_ON_REVIEW' | 'BULK_DIGEST'`), `payload` (JSON snippet
   already redacted for anonymity), `created_at`, `read_at NULL`.
   `idx_notifications_recipient_created` covers the badge query;
   `idx_notifications_recipient_unread` partial-index speeds the
   unread count.
4. **New table `email_deliveries`** — one row per outbound mail
   attempt. Columns: `id`, `event_id` (FK to `notification_events`),
   `status` (`'pending' | 'sent' | 'failed' | 'suppressed'`),
   `attempt_count INTEGER NOT NULL DEFAULT 0`, `last_error TEXT`,
   `last_attempt_at INTEGER`, `next_attempt_at INTEGER`,
   `created_at`. A single `pending`-or-failed (eligible) row per
   event ensures idempotent retries; backoff schedule is `30 s, 2 m,
   15 m, 1 h, 6 h` with a hard cap of 5 attempts (then `failed`).
5. **New table `email_preferences`** — per-user toggles. Columns:
   `user_id` (PK, FK), `status_changes INTEGER NOT NULL DEFAULT 1`,
   `comments_on_my_ideas INTEGER NOT NULL DEFAULT 1`,
   `ratings_on_my_ideas INTEGER NOT NULL DEFAULT 1`,
   `replies_on_ideas_i_review INTEGER NOT NULL DEFAULT 1`,
   `updated_at INTEGER NOT NULL`. Missing rows are interpreted as
   "all defaults ON" (so existing users do not have to be back-filled
   for the migration to be correct).
6. **Back-fill** — for every existing `ideas` row, INSERT a
   `version_no = 1` snapshot built from the current column values;
   for every `status_transitions` row whose `from_state = to_state`
   AND `comment` starts with the Phase-3 `EDITED:` marker, INSERT a
   subsequent `idea_versions` row reconstructed from the audit JSON
   (falling back to the *current* values if the audit row predates
   the Phase-3 snapshot format). Drift between the back-fill and the
   true historical state is acceptable per spec Assumption — the
   point is the version list is coherent, not byte-perfect.

**Testing**: Vitest 1.6 (`unit` + `integration` projects), RTL 16,
Playwright 1.45 with `@axe-core/playwright`. Coverage thresholds
unchanged (≥ 70 % line on `src/server/**` and the business-logic
subset of `src/lib/**`). Email transport is mocked at the
`src/server/infra/email-transport.ts` boundary (V.6 — own the
interface, mock the third party).

**Target Platform**: identical to Phase 1–4 (Chromium / Firefox /
Safari on desktop / tablet / mobile ≥ 360 px). Email rendering is
exercised against a single transactional template baseline (no
Outlook-specific tables); accessibility lives in the in-app surfaces.

**Project Type**: Full-stack web app (Next.js, single repo).

**Performance Goals**:

- 95 % of `POST /api/ideas/[id]/attachments` (the multi-file batch
  endpoint), `GET /api/ideas/[id]/versions`,
  `GET /api/ideas/[id]/versions/diff`, `GET /api/notifications`,
  `PUT /api/me/email-preferences` complete under **500 ms** server-
  side at the spec's scale (≤ 50 000 comments / ≤ 200 000 ratings /
  ≤ 10 000 ideas).
- Preview start time (server-side rendering of the response stream
  for files ≤ 5 MB) ≤ **1.5 s** on the project baseline machine
  (NFR-001).
- Notification delivery: ≥ 95 % of mails are flagged `sent` by the
  SMTP receipt within **30 s** of the originating event (NFR-002 /
  SC-002). First-attempt window is `~5 s` (the worker wakes once a
  second by default).
- In-app badge polling at 60 s costs **one indexed-count query**
  (`SELECT COUNT(*) FROM notification_events WHERE recipient_id = ?
  AND read_at IS NULL`) — cheap enough that the user can be on any
  page.

**Constraints**: no external services beyond an SMTP relay (operator-
supplied); no new database engine; no new authentication mechanism;
no new role; no change to the anonymity policy (ADR-0018) — the
anonymity projection is **reused** when building each notification
payload (so a reviewer mail never carries the submitter's name even
in headers, FR-013). Preview responses MUST set
`Content-Disposition: inline; filename="<sanitised>"`,
`Content-Security-Policy: sandbox`, and `X-Content-Type-Options:
nosniff`; the iframe wrapper sets `sandbox="allow-same-origin"` only
when strictly required for PDF navigation (NFR-006).

**Scale/Scope**: ≤ 1 000 active users, ≤ 10 000 ideas, ≤ 50 000
comments, ≤ 200 000 ratings, **≤ 100 000 attachments** (10 per idea
upper bound × 10 000 ideas), **≤ 500 000 notification events** at
two years of operation. 33 functional requirements (FR-001..033),
6 non-functional requirements, 7 success criteria, 3 user stories.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution at **v1.4.0** has **10 principles** and **12 quality
gates**. Each is evaluated below; **no violations require
justification**.

### Principle compliance

| Principle | Compliance |
|---|---|
| **I. Clean Code** | New server modules (`attachment-service.ts` (extended), `notification-service.ts`, `email-dispatcher.ts`, `version-service.ts`, `diff-service.ts`, `email-preference-service.ts`) are single-purpose. The email dispatcher is one pure function `dispatchPending(now)` that picks eligible rows and posts to the transport — no time, no randomness leaked outside injected ports. Diff computation is a pure function `diffIdeaVersions(a, b)` that takes two snapshots and returns a typed hunk array. No dead code; no inline TODOs. |
| **II. TypeScript Strict** | Every payload (attachment upload batch, version range query, diff endpoint params, email-preferences PUT, notification mark-read) is parsed through a Zod schema. The `notification_events.payload` JSON column is encoded/decoded through a Zod tagged-union schema so the type boundary survives storage. No `any`, no `!`, no `@ts-ignore`. `NotificationEventKind` is a string-literal union derived from the SQLite enum. |
| **III. Testing Pyramid 70%** | New business logic (`notification-service.ts`, `email-dispatcher.ts`, `version-service.ts`, `diff-service.ts`, `email-preference-service.ts`, extended `attachment-service.ts`, the anonymity projection extension for emails) sits in `src/server/**` and `src/lib/**`, both inside the 70 % floor. The email transport adapter (`src/server/infra/email-transport.ts`) is interface-only; the SMTP-talking implementation is excluded (network code, no business logic). |
| **IV. JSDoc** | Every exported function, type, and component prop gets a JSDoc block (`@param` + `@returns` + `@throws` where applicable). `diffIdeaVersions`, `effectiveEmailRecipients`, and `redactPayloadForRecipient` carry `@example` because their contracts (one-way anonymity, "reviewer set" definition, diff hunk shape) are non-obvious. |
| **V. Testing Principles** | AAA layout; `beforeEach` isolation; in-memory fakes for unit tests of services; fresh SQLite per integration suite. Diff is unit-tested as a pure function with `it.each` tables (one assertion per case). Email dispatch is contract-tested against a recording fake transport so retries, suppressions, and anonymity redaction are observable. Notification badge polling is integration-tested at the API level (not by spinning real timers). |
| **VI. UX (responsive, a11y, polish)** | Every new surface carries explicit loading / empty / error / success states. The attachment manager is keyboard-operable (Tab to focus a card, Enter to open, Delete to remove with a confirm dialog). The preview is wrapped in a `<dialog>` that traps focus and restores it on close. The version timeline is a `<nav>` with `<ol>`; the diff viewer is a `<table>` with row headers when in side-by-side. Mobile-first: the attachment grid collapses to one column < `sm:`; the diff viewer falls back to a unified view < `md:`. `@axe-core/playwright` covers every new page. |
| **VII. Consistency (UI, code, error codes)** | New error codes added to `src/lib/errors/codes.ts` (see "Error-code surface" below). UI strings live in `error-messages.ts`. No hard-coded hex; diff red/green are tokens (`--diff-add`, `--diff-remove`, `--diff-add-bg`, `--diff-remove-bg`) wired through `tokens.css` for both themes. Every new API surface conforms to the existing error envelope. |
| **VIII. Commit & Push Discipline** | SpecKit `auto_commit` hooks (`.specify/extensions.yml`) plus the `post-commit` push hook drive Conventional Commits + immediate `git push` per lifecycle step and per task. |
| **IX. ADR-Backed Design Choices** | Every load-bearing choice has a MADR ADR under [./adr/](./adr/): nodemailer SMTP + queued-with-backoff send model (ADR-0023); `diff` npm package + per-field snapshot strategy (ADR-0024); browser-native preview with sandboxed iframe + download fallback (ADR-0025); in-app notification badge polling at 60 s (ADR-0026). |
| **X. Feature Merge Discipline** | Feature branch `005-attachments-history-notifications` merges to `main` exclusively via `git merge --no-ff` once Quality Gates 1–11 pass. Encoded as the final task in `tasks.md`. |

### Quality gates

| # | Gate | How this plan satisfies it |
|---|---|---|
| 1 | `tsc --noEmit` strict | unchanged; `npm run typecheck` in CI. |
| 2 | ESLint + Prettier zero errors | unchanged toolchain. |
| 3 | Unit + integration + E2E pass | new tests in each tier (see [./quickstart.md](./quickstart.md)). |
| 4 | ≥ 70 % line on business logic | new modules covered ≥ 70 %; email transport adapter (network code) excluded explicitly. |
| 5 | JSDoc on exports | `eslint-plugin-jsdoc` enforces. |
| 6 | Code review / Constitution note | solo course project — self-review with rationale per PR. |
| 7 | Constitution Check | this section. |
| 8 | A11y / responsiveness | jsx-a11y + axe; manual checklist for attachment manager, preview dialog, version timeline, diff viewer, email-preferences page, notification dropdown at all three breakpoints (Constitution VI.1) and in both themes (FR-031). |
| 9 | Consistency | new error codes (listed below) with one-test-per-code; error envelope reused unchanged; preview/diff/notification components consume Tailwind tokens; no inline `style` props. |
| 10 | Commit & push discipline | inherited automation. |
| 11 | ADR coverage | ADR-0023..0026 cover every new design choice; ADR index `specs/005-attachments-history-notifications/adr/README.md` lists them. |
| 12 | Feature merge-back | final task performs `git merge --no-ff` to `main`. |

### Error-code surface (added to `src/lib/errors/codes.ts`)

| Code | HTTP | Where it fires |
|---|---|---|
| `ATTACHMENT_LIMIT_EXCEEDED` | `422` | > 10 attachments on an idea (FR-001). |
| `ATTACHMENT_QUOTA_EXCEEDED` | `422` | Cumulative bytes > 100 MB on an idea (FR-001). |
| `ATTACHMENT_ORDER_INVALID` | `400` | Reorder payload references unknown ids or has duplicates. |
| `ATTACHMENT_FORBIDDEN` | `403` | Non-author attempts add/remove/reorder; also when idea state forbids edit. |
| `IDEA_VERSION_NOT_FOUND` | `404` | Version id (or version_no) does not exist on the idea. |
| `IDEA_VERSION_RANGE_INVALID` | `400` | Diff endpoint passed a non-existent `from`/`to`, or `from == to`. |
| `NOTIFICATION_NOT_FOUND` | `404` | Mark-read on an event not belonging to the caller. |
| `NOTIFICATION_FORBIDDEN` | `403` | Reading another user's notifications. |
| `EMAIL_PREFERENCE_INVALID` | `400` | Payload not matching the toggles schema. |
| `EMAIL_DELIVERY_PERMANENT_FAILURE` | logged-only (no HTTP surface) | Recorded for ops when retries exhaust; never returned to the user. |

`PREVIEW_UNSUPPORTED` is **not** an error code — unsupported types
degrade silently to the download card per FR-003. Each new code is
covered by at least one integration test (Gate #9).

### Excluded coverage paths (documented per V.2)

Unchanged from Phase 1–4 (`src/app/**` page/layout files,
`src/components/ui/**`, `src/lib/errors/codes.ts`, `drizzle/**`,
`src/db/seed.ts`, `src/components/insights/charts/*`). Newly excluded
in Phase 5:

- `src/server/infra/email-transport.ts` — interface + thin SMTP
  binding around `nodemailer.createTransport(...).sendMail(...)`. No
  business logic; mocked in every unit test of `email-dispatcher.ts`.
- `src/server/infra/notification-poller.ts` — `setInterval`-based
  worker bootstrap. The pure function it drives (`dispatchPending`)
  IS covered.
- `src/app/api/attachments/[id]/preview/route.ts` — thin streaming
  wrapper around `fs.createReadStream` with response headers. Header
  contract IS integration-tested via `tests/integration/attachment-
  preview-headers.test.ts`.

**Result**: PASS. Re-check after Phase 1 design — no expected drift.

## Project Structure

### Documentation (this feature)

```text
specs/005-attachments-history-notifications/
├── plan.md              # This file
├── spec.md              # Authoritative spec
├── research.md          # Phase 0 — decisions & alternatives
├── data-model.md        # Phase 1 — entities + migration + payload shapes
├── quickstart.md        # Phase 1 — run/test/migrate locally
├── adr/
│   ├── README.md
│   ├── 0023-nodemailer-smtp-transport.md
│   ├── 0024-version-history-and-diff-strategy.md
│   ├── 0025-attachment-preview-sandbox.md
│   └── 0026-in-app-notification-polling.md
├── contracts/
│   └── openapi.yaml     # Phase 1 — REST delta for attachments, versions, notifications, preferences
├── checklists/
│   └── requirements.md  # (carried over from /speckit.specify; not authored here)
└── tasks.md             # Phase 2 output — generated by /speckit.tasks
```

### Source Code (repository root) — additions and changes only

```text
project/
├── drizzle/
│   └── 0004_attachments_history_notifications.sql # NEW migration (1 table mod + 4 new tables + back-fill)
├── src/
│   ├── app/
│   │   ├── (employee)/
│   │   │   ├── ideas/[id]/page.tsx                # CHANGED — gallery + version tab + diff viewer
│   │   │   └── ideas/new/page.tsx                 # CHANGED — multi-file dropzone
│   │   ├── (reviewer)/queue/page.tsx              # CHANGED — preview thumb on row
│   │   ├── account/preferences/page.tsx           # NEW — email preferences (FR-014)
│   │   └── api/
│   │       ├── ideas/[id]/attachments/route.ts    # CHANGED — POST = batch upload, GET = list ordered
│   │       ├── ideas/[id]/attachments/[attachmentId]/route.ts # NEW — DELETE one, PATCH reorder
│   │       ├── attachments/[id]/preview/route.ts  # NEW — inline preview stream (CSP-sandbox headers)
│   │       ├── ideas/[id]/versions/route.ts       # NEW — GET version list
│   │       ├── ideas/[id]/versions/[versionNo]/route.ts # NEW — GET single snapshot
│   │       ├── ideas/[id]/versions/diff/route.ts  # NEW — GET diff between two versions
│   │       ├── notifications/route.ts             # NEW — GET unread + recent
│   │       ├── notifications/[id]/read/route.ts   # NEW — POST mark-read
│   │       └── me/email-preferences/route.ts      # NEW — GET, PUT
│   ├── components/
│   │   ├── attachments/
│   │   │   ├── attachment-manager.tsx             # NEW — dropzone, progress, reorder, remove
│   │   │   ├── attachment-card.tsx                # NEW — thumb + name + size + actions
│   │   │   ├── attachment-gallery.tsx             # NEW — read-only grid on detail page
│   │   │   └── attachment-preview-dialog.tsx     # NEW — focus-trapped <dialog> wrapping iframe
│   │   ├── versions/
│   │   │   ├── version-timeline.tsx               # NEW — <ol> of versions
│   │   │   ├── version-readonly-view.tsx          # NEW — historical render of a single version
│   │   │   └── diff-viewer.tsx                    # NEW — side-by-side / unified switch + hunk render
│   │   ├── notifications/
│   │   │   ├── notification-badge.tsx             # NEW — count chip in app-shell
│   │   │   └── notification-dropdown.tsx          # NEW — list + mark-read + deep link
│   │   └── account/
│   │       └── email-preferences-form.tsx         # NEW — toggle group
│   ├── server/
│   │   ├── attachment-service.ts                  # CHANGED — multi-attach, reorder, quota, list
│   │   ├── notification-service.ts                # NEW — enqueue + redact + reviewer-set
│   │   ├── email-dispatcher.ts                    # NEW — pure dispatchPending(now, deps)
│   │   ├── email-preference-service.ts            # NEW
│   │   ├── version-service.ts                     # NEW — write snapshot, list, hydrate
│   │   ├── diff-service.ts                        # NEW — pure diffIdeaVersions(a, b)
│   │   ├── idea-service.ts                        # CHANGED — emits notification events + version snapshots
│   │   └── infra/
│   │       ├── email-transport.ts                 # NEW — interface + nodemailer impl
│   │       └── notification-poller.ts             # NEW — setInterval bootstrap (excluded)
│   ├── db/
│   │   └── repositories/
│   │       ├── attachment-repo.ts                 # CHANGED — listByIdea, reorder, multi-link
│   │       ├── notification-repo.ts               # NEW
│   │       ├── email-delivery-repo.ts             # NEW
│   │       ├── email-preference-repo.ts           # NEW
│   │       └── idea-version-repo.ts               # NEW
│   ├── lib/
│   │   ├── validation/
│   │   │   ├── attachment.ts                      # CHANGED — reorder payload, batch size cap
│   │   │   ├── notification.ts                    # NEW
│   │   │   ├── email-preference.ts                # NEW
│   │   │   └── version.ts                         # NEW — version range query
│   │   ├── format/
│   │   │   ├── plain-text.ts                      # CHANGED — extended safe-tag whitelist for markdown preview
│   │   │   └── diff-snippet.ts                    # NEW — first N chars of a diff hunk for email body
│   │   ├── hooks/
│   │   │   ├── use-notifications.ts               # NEW — 60s polling hook (ADR-0026)
│   │   │   └── use-attachment-uploader.ts         # NEW — per-file progress state
│   │   └── errors/
│   │       ├── codes.ts                           # CHANGED — add 9 new codes
│   │       └── error-messages.ts                  # CHANGED — UI copy for new codes
│   ├── styles/
│   │   └── tokens.css                             # CHANGED — add --diff-add(-bg), --diff-remove(-bg) variables
│   └── types/index.ts                             # CHANGED — re-export NotificationEvent, IdeaVersion, AttachmentSummary, EmailPreference
├── tests/
│   ├── unit/
│   │   ├── server/notification-service.test.ts                 # NEW
│   │   ├── server/email-dispatcher.test.ts                     # NEW — fake transport, asserts retries & backoff
│   │   ├── server/email-preference-service.test.ts             # NEW
│   │   ├── server/version-service.test.ts                      # NEW
│   │   ├── server/diff-service.test.ts                         # NEW
│   │   ├── server/attachment-service.test.ts                   # CHANGED — multi/reorder/quota cases
│   │   ├── lib/format/diff-snippet.test.ts                     # NEW
│   │   ├── lib/format/plain-text-markdown.test.ts              # NEW — extended whitelist
│   │   └── lib/validation/{attachment,notification,version,email-preference}.test.ts # NEW or CHANGED
│   ├── integration/
│   │   ├── attachments-multi-upload.test.ts                    # NEW (Story 1)
│   │   ├── attachment-preview-headers.test.ts                  # NEW (NFR-006, ADR-0025)
│   │   ├── idea-versions-snapshot-on-edit.test.ts              # NEW (Story 3, FR-020)
│   │   ├── idea-versions-diff.test.ts                          # NEW (Story 3, FR-023..024)
│   │   ├── notifications-fanout.test.ts                        # NEW (Story 2, FR-010..012, FR-017)
│   │   ├── notifications-anonymity.test.ts                     # NEW (FR-013)
│   │   ├── email-preferences-suppress.test.ts                  # NEW (FR-014..015)
│   │   └── notifications-badge-poll.test.ts                    # NEW (FR-015, ADR-0026)
│   └── e2e/
│       ├── employee-multi-attachment-and-preview.spec.ts       # NEW (Story 1, axe-checked, both themes)
│       ├── reviewer-receives-email-and-badge.spec.ts           # NEW (Story 2, axe-checked, both themes)
│       └── author-compares-idea-versions.spec.ts               # NEW (Story 3, axe-checked, both themes)
```

**Structure Decision**: Reuse the existing single-app Next.js layout
under `src/`. No new top-level folder. Each new concern (attachments
v2, notifications, versions, diff, email preferences) is isolated
into its own small `src/server/` module and its own
`src/components/<concern>/` folder, mirroring the Phase-3/4 pattern.
The Phase-4 `AppShell` is the natural mount point for the
notification badge (top-right) and is reused unchanged — only its
header slot list gains one component.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _none_ | _n/a_ | _n/a_ |
