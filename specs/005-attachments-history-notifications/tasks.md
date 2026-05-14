---
description: "Task list for feature 005-attachments-history-notifications"
---

# Tasks: Attachments, Version History & Notifications (Phase 5)

**Input**: Design documents from
`/specs/005-attachments-history-notifications/`
**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md),
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/openapi.yaml](./contracts/openapi.yaml),
[quickstart.md](./quickstart.md),
[adr/](./adr/) (0023–0026).

**Tests**: REQUIRED. Constitution Principle III + Quality Gate 3
mandate the testing pyramid; every business-logic task ships with
its tests.

**Organization**: Tasks are grouped by user story so each story can
be implemented, tested, and demoed in isolation. Three user stories
(US1 Multi-attachment + preview P1, US2 Email + in-app notifications
P1, US3 Version history + diff viewer P2). MVP = Setup +
Foundational + US1 + US2.

**Dark mode is non-negotiable** (FR-030..033, ADR-0022). Every UI
task below explicitly notes the design-token / theme contract it must
satisfy: components consume `src/styles/tokens.css` CSS-variables
only (no hex literals, no inline `style` props outside
`src/components/ui/**`), render in both `light` and `dark` themes
with WCAG AA contrast, and re-theme live on toggle.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: parallelizable (different files, no upstream dependency)
- **[Story]**: which user story the task belongs to (US1…US3).
  Setup, Foundational, and Polish tasks carry no story label.
- Every task includes the exact file path it touches.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: small repo-wide groundwork shared by every story.

- [X] T001 Add 9 new error codes to `src/lib/errors/codes.ts` — `ATTACHMENT_LIMIT_EXCEEDED`, `ATTACHMENT_QUOTA_EXCEEDED`, `ATTACHMENT_ORDER_INVALID`, `ATTACHMENT_FORBIDDEN`, `IDEA_VERSION_NOT_FOUND`, `IDEA_VERSION_RANGE_INVALID`, `NOTIFICATION_NOT_FOUND`, `NOTIFICATION_FORBIDDEN`, `EMAIL_PREFERENCE_INVALID` (plus log-only `EMAIL_DELIVERY_PERMANENT_FAILURE`)
- [X] T002 [P] Add matching UI copy for the new codes in `src/lib/errors/error-messages.ts`
- [X] T003 [P] Add `tests/unit/lib/errors/new-codes-005.test.ts` asserting every new code maps to a UI message (Quality Gate 9)
- [X] T004 [P] Add `nodemailer ^6.9` and `diff ^5.2` runtime dependencies plus `@types/nodemailer` dev dep to `package.json` and refresh the lockfile per [ADR-0023](./adr/0023-nodemailer-smtp-transport.md) and [ADR-0024](./adr/0024-version-history-and-diff-strategy.md)
- [X] T005 [P] Extend `SecurityEvent.event` union in `src/server/infra/logger.ts` with `attachment_added`, `attachment_removed`, `attachment_reordered`, `idea_version_snapshotted`, `notification_enqueued`, `email_dispatch_failed_permanent`, `email_preferences_updated`
- [X] T006 [P] Add Phase-5 SMTP env vars (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `MAIL_FROM`, `NOTIFICATION_POLL_INTERVAL_MS`) to `.env.example` and document them in `README.md` per [./quickstart.md](./quickstart.md)

**Checkpoint**: shared codes, deps, audit-event vocabulary, and SMTP env are wired in.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema migration, new design tokens, transport
interface, anonymity-aware payload helper, and the shared validators
every user story consumes.
**⚠️ CRITICAL**: no user-story work may start until this phase is
complete.

- [X] T007 Create migration `drizzle/0004_attachments_history_notifications.sql` per [data-model.md §1](./data-model.md#1-schema-delta) — DROP `uniq_attachments_idea`; ADD `attachments.display_order` + `idx_attachments_idea_order`; CREATE `idea_versions`, `notification_events`, `email_deliveries`, `email_preferences` with their indexes; back-fill `idea_versions.v1` for every existing idea. Snapshot at `drizzle/meta/0004_snapshot.json`
- [X] T008 [P] Extend `src/db/migrate.ts` with the TypeScript back-fill step that walks Phase-3 `EDITED` audit rows in `status_transitions` and inserts the reconstructed subsequent `idea_versions` rows (step 7 of data-model §1); unit-tested in T013
- [X] T009 [P] Mirror the migration in Drizzle schemas — `src/db/schema/idea-versions.ts`, `src/db/schema/notification-events.ts`, `src/db/schema/email-deliveries.ts`, `src/db/schema/email-preferences.ts`; extend `src/db/schema/attachments.ts` with `display_order`; re-export from `src/db/schema/index.ts`
- [X] T010 [P] **[Dark mode]** Add diff highlight tokens (`--diff-add`, `--diff-add-bg`, `--diff-remove`, `--diff-remove-bg`) for both `:root` (light) and `[data-theme="dark"]` to `src/styles/tokens.css` with WCAG AA contrast against `--background`/`--foreground`; ADR-0022 compliant — no hex outside this file
- [X] T011 [P] Add `src/lib/validation/attachment.ts` (extended) — `AttachmentBatchUploadSchema` (≤ 10 files, ≤ 25 MB each, ≤ 100 MB total), `AttachmentReorderSchema` (`orderedIds: string[].min(1).max(10)`)
- [X] T012 [P] Add `src/lib/validation/notification.ts` (`NotificationKindEnum`, `NotificationPayloadSchema` tagged-union per [data-model §5](./data-model.md#5-entity--notificationevent)), `src/lib/validation/version.ts` (`VersionRangeSchema` with `from < to`, both ≥ 1), `src/lib/validation/email-preference.ts` (`EmailPreferenceUpdateSchema` — all booleans optional)
- [X] T013 [P] [unit-tests] `tests/unit/lib/validation/attachment.test.ts`, `notification.test.ts`, `version.test.ts`, `email-preference.test.ts` — one assertion per boundary case via `it.each`
- [X] T014 [P] Re-export `AttachmentSummary` (refined), `IdeaVersion`, `IdeaVersionSummary`, `IdeaDiff`, `IdeaDiffField`, `ProseHunk`, `NotificationEvent`, `NotificationKind`, `NotificationPayload`, `EmailDelivery`, `EmailPreference` from `src/types/index.ts`
- [X] T015 [P] Add `src/server/infra/email-transport.ts` — exports `EmailTransport` interface (`send(msg: OutboundMail): Promise<void>`) and `createNodemailerTransport()` SMTP-binding factory; interface-only (no business logic — excluded from coverage per Constitution V.2)
- [X] T016 [P] Add in-memory `FakeEmailTransport` recorder under `tests/helpers/fake-email-transport.ts` (records sent messages in an array; clearable per-test) for unit + integration use
- [X] T017 [P] Extend `src/server/anonymity.ts` (from feature 004) with `redactPayloadForRecipient(event, recipientRole)` — pure function that runs the existing `maskAuthor` projection over a notification payload at enqueue time; JSDoc `@example` mandatory (Principle IV)
- [X] T018 [P] [unit-tests] `tests/unit/server/anonymity-redact-payload.test.ts` — every (event kind × idea.anonymous × recipient role) cell via `it.each`; one assertion per case
- [X] T019 [P] Extend `src/lib/format/plain-text.ts` with a bounded safe-tag whitelist (`<h1..h6>`, `<p>`, `<ul>/<ol>/<li>`, `<code>`, `<pre>`, `<a rel="noopener noreferrer" target="_blank">`, `<strong>`, `<em>`, `<br>`) — no `<script>`, no `<img>`, no `on*` handlers; SVG goes through download fallback
- [X] T020 [P] [unit-tests] `tests/unit/lib/format/plain-text-markdown.test.ts` — every disallowed tag stripped, every allowed tag preserved, attribute injection (`onerror=`, `javascript:` href) neutralised
- [X] T021 [P] Add `src/db/repositories/notification-repo.ts`, `src/db/repositories/email-delivery-repo.ts`, `src/db/repositories/email-preference-repo.ts`, `src/db/repositories/idea-version-repo.ts`; extend `src/db/repositories/attachment-repo.ts` with `listByIdeaOrdered`, `reorder`, `insertBatch`, `sumBytesForIdea`

**Checkpoint**: schema migrated, validators ready, transport interface in place, design tokens published, anonymity payload helper covered. User-story phases may now proceed in parallel.

---

## Phase 3: User Story 1 — Attach and preview multiple files on an idea (Priority: P1) 🎯 MVP

**Goal**: an Employee author attaches 1..10 files (25 MB each /
100 MB total) to a draft or `SUBMITTED` idea, sees per-file upload
progress, reorders, removes; every viewer with read access sees
inline previews (image / PDF / text-markdown) or a download card for
unsupported types, served behind sandboxed CSP headers
([ADR-0025](./adr/0025-attachment-preview-sandbox.md)).

**Independent Test**: an Employee opens their draft, drops a PNG +
PDF + `.md`, watches three progress bars complete, reorders them,
saves; a reviewer opens the idea in another browser and sees three
preview cards rendering inline without leaving the page; uploading
an 11th file returns `ATTACHMENT_LIMIT_EXCEEDED`; uploading a 30 MB
file returns `ATTACHMENT_TOO_LARGE`.

### Tests for User Story 1 ⚠️ (write first, ensure they fail)

- [X] T022 [P] [US1] `tests/unit/server/attachment-service.test.ts` (extended) — `attachToIdea` happy multi-upload; `ATTACHMENT_LIMIT_EXCEEDED` at the 11th file; `ATTACHMENT_QUOTA_EXCEEDED` at the byte cap; `ATTACHMENT_FORBIDDEN` for non-author and for non-editable state; `reorderAttachments` rejects unknown ids / duplicates with `ATTACHMENT_ORDER_INVALID`; `removeAttachment` cascades the on-disk GC schedule
- [X] T023 [P] [US1] `tests/integration/attachments-multi-upload.test.ts` — batch POST round-trip; per-file validation errors are returned against the offending file index; resulting list ordered by `displayOrder`; staged-pre-save and saved-to-idea paths both covered (FR-001..005)
- [X] T024 [P] [US1] `tests/integration/attachment-preview-headers.test.ts` — `Content-Disposition: inline`, `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff` on every preview response; markdown body arrives as sanitised HTML; SVG falls back to download (NFR-006, [ADR-0025](./adr/0025-attachment-preview-sandbox.md))
- [!] T025 (deferred to Phase 6 polish) [P] [US1] `tests/integration/attachment-preview-perf.test.ts` — for a 5 MB PDF, response headers arrive < 100 ms, first byte < 500 ms on the baseline (NFR-001)
- [!] T026 (deferred to Phase 6 polish) [P] [US1] `tests/e2e/employee-multi-attachment-and-preview.spec.ts` (Playwright + axe) — drop 3 files → progress → reorder → save → reload as reviewer → preview each → axe scan passes in **both light and dark themes** (FR-030..033)

### Implementation for User Story 1

- [X] T027 [US1] Extend `src/server/attachment-service.ts` — `attachToIdea(ideaId, files, actor)`, `reorderAttachments(ideaId, orderedIds, actor)`, `removeAttachment(attachmentId, actor)`, `listForIdea(ideaId, viewer)`; quota / count / state / actor checks per FR-001..005; emits `attachment_added` / `_removed` / `_reordered` audit events. Depends on T021
- [X] T028 [US1] Add `src/app/api/attachments/[id]/preview/route.ts` — streams bytes with `Content-Disposition: inline; filename="<sanitised>"`, `Content-Security-Policy: sandbox`, `X-Content-Type-Options: nosniff`; markdown sanitised via T019; SVG short-circuits to a 415-equivalent download path; thin wrapper, excluded from coverage but header contract tested in T024
- [X] T029 [US1] Update `src/app/api/ideas/[id]/attachments/route.ts` — `GET` returns ordered list; `POST` becomes a multipart batch upload; `PATCH` accepts `AttachmentReorderSchema`; uses T027 service. Depends on T027
- [X] T030 [US1] Add `src/app/api/ideas/[id]/attachments/[attachmentId]/route.ts` — `DELETE` one attachment; uses T027 service
- [!] T031 (deferred to Phase 6 polish) [P] [US1] Add `src/lib/hooks/use-attachment-uploader.ts` — per-file progress state, cancel handler, last-write-wins ordering after server reorder confirmation
- [!] T032 (deferred to Phase 6 polish) [P] [US1] **[Dark mode]** Add `src/components/attachments/attachment-manager.tsx` (dropzone + reorder via keyboard and drag + per-file progress + remove with confirm) — every surface (drop zone outline, progress bar, error badges, focus rings) consumes `tokens.css` CSS variables; no hex literals; verified in both themes
- [!] T033 (deferred to Phase 6 polish) [P] [US1] **[Dark mode]** Add `src/components/attachments/attachment-card.tsx` (thumb / name / size / actions) and `src/components/attachments/attachment-gallery.tsx` (read-only grid for viewers); tokens-only styling; mobile collapses to one column < `sm:` (NFR-005, FR-030..033)
- [!] T034 (deferred to Phase 6 polish) [P] [US1] **[Dark mode]** Add `src/components/attachments/attachment-preview-dialog.tsx` — `<dialog>` focus-trap, ESC + backdrop close, restores focus on close; wraps `<iframe sandbox="allow-same-origin">` for PDF / text and `<img>` for images; chrome (toolbar, close button, error/loading/empty states) consumes tokens, including the iframe's surrounding frame in dark mode (FR-031, NFR-005)
- [!] T035 (deferred to Phase 6 polish) [US1] Wire the manager into `src/app/(employee)/ideas/new/page.tsx` and the edit branch of `src/app/(employee)/ideas/[id]/page.tsx`; wire the gallery + dialog into the read view of `src/app/(employee)/ideas/[id]/page.tsx` and the reviewer variant; loading / empty / error states use tokens. Depends on T032, T033, T034
- [!] T036 (deferred to Phase 6 polish) [P] [US1] **[Dark mode]** Add preview thumb to `src/app/(reviewer)/queue/page.tsx` queue rows (first attachment only); uses `attachment-card` in compact variant; tokens-only

**Checkpoint**: US1 demoable end-to-end; multi-attachment, preview, reorder, removal, and quota enforcement all work in both themes.

---

## Phase 4: User Story 2 — Email me when my idea moves or someone gives feedback (Priority: P1)

**Goal**: status transitions, new comments, new ratings, and replies
on reviewed ideas dispatch transactional email via an SMTP relay
(retried with backoff, never blocking the originating domain write)
and produce in-app notification badge entries; per-user preferences
suppress mail (but never the badge); anonymity is applied at enqueue
time so reviewers never see submitter identity on anonymous ideas
([ADR-0023](./adr/0023-nodemailer-smtp-transport.md),
[ADR-0026](./adr/0026-in-app-notification-polling.md), ADR-0018).

**Independent Test**: a reviewer transitions `SUBMITTED →
UNDER_REVIEW` and posts a comment; within ≤ 30 s the author has two
mails in Mailpit and a badge of `2`; the author opens
`/account/preferences`, toggles "Comments off", a second reviewer
comment produces a badge entry but no mail; an anonymous-category
idea's reviewer mail carries no submitter name in body, subject, or
`From` header.

### Tests for User Story 2 ⚠️

- [X] T037 [P] [US2] `tests/unit/server/notification-service.test.ts` — `enqueue` writes one `notification_events` row per recipient and one `email_deliveries` row only when the matching preference is on; `BULK_DIGEST` collapses one Admin transition of N ideas into one row per recipient (FR-017); `listForUser` returns unread count + recent 50; `markRead` is idempotent
- [X] T038 [P] [US2] `tests/unit/server/email-dispatcher.test.ts` — `dispatchPending(now, deps)` is pure given an injected clock + fake transport (T016); asserts the `30 s / 2 m / 15 m / 1 h / 6 h` backoff schedule, terminal `failed` at attempt 6, terminal `suppressed` when preference is off at dispatch time; never throws — failures are recorded
- [X] T039 [P] [US2] `tests/unit/server/email-preference-service.test.ts` — `get(userId)` returns defaults when row missing; `update(userId, prefs)` upserts; `EMAIL_PREFERENCE_INVALID` for unknown keys; `updatedAt` bumped
- [X] T040 [P] [US2] `tests/integration/notifications-fanout.test.ts` — `STATUS_CHANGED`, `COMMENT_ADDED`, `RATING_ADDED`, `REPLY_ON_REVIEW` fan-out from a single domain transaction, each to the correct recipient set (author / reviewers-who-have-engaged); bulk Admin transition collapses to one digest per recipient (FR-010..012, FR-017)
- [X] T041 [P] [US2] `tests/integration/notifications-anonymity.test.ts` — for an anonymous-category idea, a reviewer-bound mail's body, subject, and `From` header contain no submitter identity; a submitter-bound mail masks reviewer identity per ADR-0018 (FR-013)
- [X] T042 [P] [US2] `tests/integration/email-preferences-suppress.test.ts` — toggling a preference off produces `suppressed` rows for the next matching event but the badge still increments (FR-014..015)
- [X] T043 [P] [US2] `tests/integration/notifications-badge-poll.test.ts` — `GET /api/notifications` SQL plan uses `idx_notifications_recipient_unread` (asserted via `EXPLAIN QUERY PLAN`); response carries `{ unreadCount, items }` capped at 50
- [X] T044 [P] [US2] `tests/integration/notifications-failed-send-isolation.test.ts` — transport throws; the originating `ideas` / `comments` / `ratings` row is still committed; `email_deliveries.status = pending` with `attempt_count = 1` and a `next_attempt_at` set (FR-016, NFR-003)
- [X] T045 [P] [US2] `tests/e2e/reviewer-receives-email-and-badge.spec.ts` (Playwright + axe + FakeEmailTransport) — status change + comment by reviewer → author sees badge in `AppShell` and mail in the fake transport queue → toggles preference → next event produces badge but no mail; axe scan of `/account/preferences` and the notification dropdown passes in **both light and dark themes** (FR-030..033)

### Implementation for User Story 2

- [X] T046 [US2] Add `src/server/email-preference-service.ts` — `get`, `update`; reads/writes via `email-preference-repo.ts`; defaults all-ON when row missing. Depends on T021
- [X] T047 [US2] Add `src/server/notification-service.ts` — `enqueue(events)` (applies `redactPayloadForRecipient` from T017 at write time + checks preferences via T046, skips `email_deliveries` row when preference is off, writes `suppressed` row when feature-spec dictates audit-trail), `listForUser`, `markRead`. Depends on T017, T021, T046
- [X] T048 [US2] Add pure `src/server/email-dispatcher.ts` exporting `dispatchPending(now, deps)` — picks rows where `status = 'pending'` AND (`next_attempt_at IS NULL` OR `<= now`) AND `attempt_count < 6`, calls `EmailTransport.send`, updates row; backoff schedule per [data-model §6](./data-model.md#6-entity--emaildelivery). Depends on T015, T021
- [X] T049 [US2] Add `src/lib/format/diff-snippet.ts` and reuse `src/lib/format/plain-text.ts` to assemble an HTML email body per kind (status / comment / rating / reply / digest) with `List-Unsubscribe` header pointing at `/account/preferences` and a visible "Update preferences" link (FR-018)
- [X] T050 [US2] Wire `src/server/idea-service.ts` (state-machine transitions) and the `comment-service` / `rating-service` from feature 004 to call `notification-service.enqueue` **after** the originating DB transaction commits, in a try/catch that logs but never rethrows (NFR-003); Admin bulk-transition collects events into a single `enqueue` call so T037 / T040's digest path fires. Depends on T047
- [!] T051 [US2] Add `src/server/infra/notification-poller.ts` — `setInterval` worker bootstrap that calls `dispatchPending` every `NOTIFICATION_POLL_INTERVAL_MS` (default 1000 ms; tests use `~250` ms); started from `src/instrumentation.ts`; thin bootstrap, excluded from coverage. Depends on T048
- [X] T052 [US2] Add `src/app/api/notifications/route.ts` (`GET` unread count + recent 50) and `src/app/api/notifications/[id]/read/route.ts` (`POST` mark-read; `NOTIFICATION_FORBIDDEN` when caller ≠ recipient). Depends on T047
- [X] T053 [US2] Add `src/app/api/me/email-preferences/route.ts` (`GET`, `PUT`); `EMAIL_PREFERENCE_INVALID` on malformed payload. Depends on T046
- [!] T054 [P] [US2] Add `src/lib/hooks/use-notifications.ts` — polls `GET /api/notifications` every 60 s, pauses when `document.hidden`, exposes `{ unreadCount, items, markRead }` ([ADR-0026](./adr/0026-in-app-notification-polling.md))
- [!] T055 [P] [US2] **[Dark mode]** Add `src/components/notifications/notification-badge.tsx` — count chip with `9+` cap; mounts in the `AppShell` header slot; uses `tokens.css` variables for chip background / foreground / focus ring; verified in both themes (FR-030..033)
- [!] T056 [P] [US2] **[Dark mode]** Add `src/components/notifications/notification-dropdown.tsx` — keyboard-operable list of recent events, per-row mark-read, deep link via `/ideas/<id>`; loading / empty / error states; tokens-only styling, including the dropdown panel, divider, hover/active rows, and "no notifications" empty state in both themes (NFR-005, FR-031)
- [!] T057 [P] [US2] **[Dark mode]** Add `src/components/account/email-preferences-form.tsx` — four toggles, "Saved · just now" status, error inline; tokens-only; tested at 360 px / 768 px / 1280 px in both themes (FR-030..033)
- [!] T058 [US2] Add page `src/app/account/preferences/page.tsx` (RSC: auth + render `EmailPreferencesForm`); empty / loading / error states use tokens. Depends on T057
- [!] T059 [US2] Mount `<NotificationBadge>` and dropdown into `src/components/layout/app-shell.tsx` header (Phase-4 AppShell, unchanged otherwise). Depends on T055, T056

**Checkpoint**: MVP slice (US1 + US2) demoable end-to-end; mail leaves the queue within ≤ 30 s; badge polls at 60 s; preferences suppress mail without suppressing the badge.

---

## Phase 5: User Story 3 — See exactly what changed between versions of an idea (Priority: P2)

**Goal**: every author edit (and the initial submit) writes an
immutable `idea_versions` snapshot in the same transaction; the
detail page exposes a Versions tab listing v1..vN; users can view
any past version as a read-only form and diff any two versions with
per-field word-level highlights for prose, "before → after" for
structured answers, and `+/–` markers for the attachment list
([ADR-0024](./adr/0024-version-history-and-diff-strategy.md)).

**Independent Test**: an Employee submits an idea (creates `v1`),
edits the title + description + one structured answer (`v2`), edits
again (`v3`); a reviewer opens the Versions tab, sees three rows,
clicks "Compare v1 → v3", sees red/green word-level diff on prose
fields, "before → after" on the structured answer, `+filename.pdf`
on the attachment line, and unchanged fields collapsed; toggling the
theme re-themes the diff red/green live.

### Tests for User Story 3 ⚠️

- [ ] T060 [P] [US3] `tests/unit/server/version-service.test.ts` — `snapshotInitial` writes `v1` inside the create transaction; `snapshotEdit` writes `v(N+1)` inside the edit transaction; concurrent edits produce two distinct versions (race → `v(N+1)` and `v(N+2)`, no overwrite); `listVersions` and `getVersion` enforce the same auth as idea detail and leak nothing (`IDEA_NOT_FOUND` for forbidden access)
- [ ] T061 [P] [US3] `tests/unit/server/diff-service.test.ts` — pure function table: prose unchanged → `changed=false`, prose word-level via `diff.diffWordsWithSpace`, structured fields as opaque `from`/`to`, attachment list via `diff.diffArrays` producing `added`/`removed` and a `reordered` flag; truncation at 200 KB sets `truncated = true` and falls back to per-paragraph; one assertion per case via `it.each`
- [ ] T062 [P] [US3] `tests/unit/lib/format/diff-snippet.test.ts` — first-N-chars hunk extraction preserves word boundaries; never splits a multi-byte character
- [ ] T063 [P] [US3] `tests/integration/idea-versions-snapshot-on-edit.test.ts` — initial submit → `v1`; subsequent author edit → `v2` in the same transaction; deleting the idea cascades versions (NFR-004); Phase-3 audit back-fill from T008 produces coherent `v2..vN` rows (FR-020)
- [ ] T064 [P] [US3] `tests/integration/idea-versions-diff.test.ts` — diff endpoint round-trip for prose / structured / attachments / unchanged fields; `IDEA_VERSION_NOT_FOUND` for missing version; `IDEA_VERSION_RANGE_INVALID` for `from == to` / `from > to` / non-existent (FR-023..025)
- [ ] T065 [P] [US3] `tests/e2e/author-compares-idea-versions.spec.ts` (Playwright + axe) — submit → edit twice → reviewer opens Versions tab → "View v1" → "Compare v1 → v3" → side-by-side; toggle to unified; toggle theme; axe passes in **both light and dark themes**; diff red/green tokens re-theme live without reload (FR-033)

### Implementation for User Story 3

- [ ] T066 [US3] Add `src/server/version-service.ts` — `snapshotInitial(idea, actor, tx)`, `snapshotEdit(idea, prevAttachments, actor, tx)`, `listVersions(ideaId, viewer)`, `getVersion(ideaId, versionNo, viewer)`; auth mirrors `idea-service` so unauthorised access returns `IDEA_NOT_FOUND`. Depends on T021
- [ ] T067 [US3] Add pure `src/server/diff-service.ts` exporting `diffIdeaVersions(a: IdeaVersion, b: IdeaVersion, attachmentsById: Map): IdeaDiff` per [data-model §4](./data-model.md#4-entity--ideadiff); uses `diff.diffWordsWithSpace` + `diff.diffArrays`; truncates at 200 KB of prose with `truncated = true`. Depends on T014
- [ ] T068 [US3] Wire `src/server/idea-service.ts` to call `snapshotInitial` on create and `snapshotEdit` on every successful author edit, both **inside** the originating transaction so a failed snapshot rolls back the edit (FR-020). Depends on T066
- [ ] T069 [US3] Add `src/app/api/ideas/[id]/versions/route.ts` (`GET` list) and `src/app/api/ideas/[id]/versions/[versionNo]/route.ts` (`GET` one snapshot). Depends on T066
- [ ] T070 [US3] Add `src/app/api/ideas/[id]/versions/diff/route.ts` (`GET ?from=&to=`) — parses `VersionRangeSchema`, hydrates both snapshots, calls `diffIdeaVersions`, returns `IdeaDiff`. Depends on T066, T067
- [ ] T071 [P] [US3] **[Dark mode]** Add `src/components/versions/version-timeline.tsx` — `<nav><ol>` of versions with timestamp + actor + actions (View / Compare); selected state, hover state, and focus ring all consume `tokens.css`; tested in both themes
- [ ] T072 [P] [US3] **[Dark mode]** Add `src/components/versions/version-readonly-view.tsx` — historical form render with an explicit "Historical · vN" label; tokens-only; renders correctly in light + dark
- [ ] T073 [P] [US3] **[Dark mode]** Add `src/components/versions/diff-viewer.tsx` — side-by-side default, unified toggle, unchanged-fields collapsed by default with a "Show unchanged" affordance; prose hunks use `--diff-add`/`--diff-add-bg`/`--diff-remove`/`--diff-remove-bg` tokens from T010 — **no hex literals, no inline `style` props**; mobile (< `md:`) falls back to unified view; theme toggle re-themes red/green live (FR-031, FR-033, SC-006)
- [ ] T074 [US3] Add the Versions tab to the idea detail page — extend `src/app/(employee)/ideas/[id]/page.tsx` (and the reviewer variant) with a "Versions" tab that mounts `VersionTimeline` + on-demand `VersionReadonlyView` / `DiffViewer`; reuses the existing tabbed layout from Phase 3 history. Depends on T071, T072, T073
- [ ] T075 [P] [US3] **[Dark mode]** Update `src/components/ideas/edit-history-list.tsx` (Phase-3 history list) to link each `EDITED` event to the matching `idea_versions` row via a "View diff" affordance using token-themed link styles in both modes

**Checkpoint**: US3 fully functional; every edit (including back-filled history) is reachable via the Versions tab and the diff viewer is theme-correct.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T076 [P] Update `README.md` and `PROJECT_SUMMARY.md` with Phase-5 capabilities (multi-attachment + preview, transactional email + in-app badge + preferences, version history + diff viewer)
- [ ] T077 [P] Update `scripts/seed-demo.ts` per [./quickstart.md §3](./quickstart.md#3-seed-sample-data-recommended) — extend two ideas with three attachments each (PNG / PDF / `.md`); one idea edited four times to populate `v1..v5`; seeded notification events for the demo users so the badge is non-empty at first render
- [ ] T078 [P] Add `scripts/perf/perf-diff.ts`, `scripts/perf/perf-notifications.ts` plus npm scripts `perf:diff`, `perf:notifications` for the NFR-001 / NFR-002 smoke
- [ ] T079 [P] Run `npm run check:error-codes` and `npm run check:ui-tokens`; extend `check-ui-tokens.ts` if needed so the new `attachments/`, `versions/`, `notifications/`, `account/` component folders are scanned (no hex outside `src/components/ui/**`); fix any drift
- [ ] T080 [P] Add JSDoc on every new export (`@param` + `@returns` + `@throws`; `@example` on `diffIdeaVersions`, `redactPayloadForRecipient`, `dispatchPending`) and run the JSDoc lint (Quality Gate 5)
- [ ] T081 [P] **[Dark mode]** Manual responsive walkthrough of every new surface at 360 px / 768 px / 1280 px in **both `light` and `dark` themes**: attachment manager, gallery, preview dialog, queue thumb, notification badge + dropdown, email-preferences page, Versions tab, diff viewer; fix any overflow / contrast / token drift (FR-030..033, SC-006, Constitution VI)
- [ ] T082 Run quickstart walkthrough end-to-end ([./quickstart.md](./quickstart.md)) and tick SC-001…SC-007
- [ ] T083 Run full pipeline: `npm run lint && npm run typecheck && npm test && npm run test:e2e && npm run format -- --check && npm run check:error-codes && npm run check:ui-tokens`
- [ ] T084 Merge feature branch back to `main` with `git merge --no-ff 005-attachments-history-notifications` (Constitution Principle X / Quality Gate 12)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no upstream dependency — start immediately.
- **Foundational (Phase 2)**: depends on Phase 1. **Blocks every user story.**
- **US1 (Phase 3)**: depends on Phase 2 (schema T007, attachment validators T011, repos T021, preview tokens via tokens.css). Independent of US2 and US3.
- **US2 (Phase 4)**: depends on Phase 2 (transport T015, fake transport T016, anonymity payload helper T017, notification + delivery + preference validators T012, repos T021). Independent of US1 and US3.
- **US3 (Phase 5)**: depends on Phase 2 (version validator T012, repos T021); the diff viewer also depends on the new diff tokens (T010).
- **Polish (Phase 6)**: depends on every chosen story being complete.

### User Story Dependencies

- **US1 (P1)**: no dependency on US2 or US3.
- **US2 (P1)**: no dependency on US1 or US3 — the notification fan-out is triggered by feature-004 state/comment/rating writes, not by US1 attachments.
- **US3 (P2)**: no dependency on US1 or US2 at the contract level. The version snapshot does record an `attachment_ids` array, but the array is built from whatever `attachment-repo.listByIdeaOrdered` returns at edit time — so US3 functions on top of the legacy single-attachment model and gains richer diffs once US1 ships. The Versions tab does not gate on the notification surface.

### Within Each User Story

- Tests are written first and must fail before implementation begins (Constitution V).
- Repositories (Phase 2) → services → route handlers → pages.
- Add JSDoc on every export (Quality Gate 5).

### Parallel Opportunities

- Phase 1: T002–T006 in parallel after T001.
- Phase 2: T008–T021 fully parallel after T007 lands. Within them: T013 waits on T011+T012; T018 waits on T017; T020 waits on T019; otherwise mutually independent files.
- Phase 3: T022–T026 in parallel; T027 first among implementation; T028 ∥ T029 ∥ T030 wait on T027; T031 ∥ T032 ∥ T033 ∥ T034 in parallel; T035 waits on T032+T033+T034; T036 in parallel with T035.
- Phase 4: T037–T045 in parallel; T046 first among implementation; T047 waits on T046; T048 in parallel with T047 (different file); T049 in parallel; T050 waits on T047; T051 waits on T048; T052 waits on T047; T053 waits on T046; T054 ∥ T055 ∥ T056 ∥ T057 in parallel; T058 waits on T057; T059 waits on T055+T056.
- Phase 5: T060–T065 in parallel; T066 first among implementation; T067 in parallel with T066; T068 waits on T066; T069 waits on T066; T070 waits on T066+T067; T071 ∥ T072 ∥ T073 in parallel; T074 waits on T071+T072+T073; T075 in parallel with the rest.
- Phase 6: T076–T081 in parallel; T082 → T083 → T084 sequential.

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Unit tests for attachment-service in tests/unit/server/attachment-service.test.ts"
Task: "Integration test attachments-multi-upload in tests/integration/attachments-multi-upload.test.ts"
Task: "Integration test attachment-preview-headers in tests/integration/attachment-preview-headers.test.ts"
Task: "Integration test attachment-preview-perf in tests/integration/attachment-preview-perf.test.ts"
Task: "E2E employee-multi-attachment-and-preview in tests/e2e/employee-multi-attachment-and-preview.spec.ts"

# Once T027 (service) lands, launch UI components in parallel:
Task: "AttachmentManager (token-themed, dark-mode verified) in src/components/attachments/attachment-manager.tsx"
Task: "AttachmentCard + AttachmentGallery (token-themed) in src/components/attachments/{attachment-card,attachment-gallery}.tsx"
Task: "AttachmentPreviewDialog (focus-trapped, token-themed) in src/components/attachments/attachment-preview-dialog.tsx"
Task: "use-attachment-uploader hook in src/lib/hooks/use-attachment-uploader.ts"
```

---

## Implementation Strategy

1. **MVP (Setup → Foundational → US1 → US2)** — multi-attachment + preview AND email + in-app notifications together cover both P1 stories and deliver the bulk of the user-visible value. Ship and demo at this point.
2. **+ Version history (US3)** — append-only snapshots + diff viewer ride on top of the now-richer attachment model; no schema rework. Ships immediately after MVP stabilises.
3. **Polish** — docs, demo data, perf smoke, full QA pipeline, manual dark-mode walkthrough at every breakpoint, merge-back to `main` with `--no-ff`.

---

## Task count summary

- Setup: 6 (T001–T006)
- Foundational: 15 (T007–T021)
- US1 Multi-attachment + Preview: 15 (T022–T036)
- US2 Email + In-app Notifications: 23 (T037–T059)
- US3 Version History + Diff Viewer: 16 (T060–T075)
- Polish & merge: 9 (T076–T084)
- **Total: 84 tasks** across 3 user stories.

Every UI task in US1 / US2 / US3 (T032, T033, T034, T036, T055, T056, T057, T071, T072, T073, T075) explicitly notes **[Dark mode]** and is bound to consume the `src/styles/tokens.css` design tokens only (no hex outside `src/components/ui/**`, no inline `style` props), render correctly in both `light` and `dark` themes, and re-theme live on toggle (FR-030..033, SC-006, ADR-0022).
