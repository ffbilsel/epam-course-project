# Phase 0 — Research: Attachments, Version History & Notifications

**Feature**: `005-attachments-history-notifications`
**Date**: 2026-05-14
**Status**: Complete — all open questions resolved by the user's
defaults message ("nodemailer SMTP for email, `diff` npm package for
diffs, browser-native preview with download fallback, 60 s polling
for in-app badges, dark-mode aware UI"). No `NEEDS CLARIFICATION`
markers remain.

## Inputs

- [spec.md](./spec.md) — 3 user stories, 33 functional requirements,
  6 non-functional requirements, 7 success criteria.
- [plan.md](./plan.md) — technical context, structure, constitution
  check.
- Constitution v1.4.0 (`.specify/memory/constitution.md`).
- Phase-1..4 codebase: idea state machine, `attachments` table with
  single-row uniqueness, `status_transitions` audit (including
  Phase-3 `EDITED` rows), Phase-4 `AppShell` + ADR-0018 anonymity
  projection + ADR-0022 design tokens.
- User defaults (this session, 2026-05-14): SMTP via nodemailer;
  `diff` npm package; browser-native preview with download fallback;
  60 s polling for in-app badges; all new UI dark-mode aware.

## Decisions resolved

### Decision 1 — Email transport

**Resolution**: `nodemailer ^6.9` talking to an operator-supplied
SMTP relay over the connection parameters carried by env vars
(`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`,
`SMTP_SECURE`, `MAIL_FROM`). Send is gated by an in-process worker
that polls a `notification_events` queue table and writes its outcome
to a sibling `email_deliveries` table; retry schedule is `30 s, 2 m,
15 m, 1 h, 6 h` with a hard cap of 5 attempts (then `failed`).

**Rationale**:

- Matches the user-provided default and the spec's Assumption that
  the application talks SMTP directly (no third-party transactional-
  mail SaaS).
- Replaceable at a tiny adapter (`src/server/infra/email-transport.
  ts`), keeping the dispatcher unit-testable with a recording fake
  (Constitution V.6).
- The queue table + separate worker keep the property "a failed
  email NEVER blocks the underlying domain transaction" trivially
  true: the transaction commits the *event* row; the dispatcher is
  oblivious to whether the underlying domain change was a transition,
  a comment, or a rating.

**Implications**:

- A single `setInterval`-based worker is bootstrapped from
  `src/instrumentation.ts` (Next.js' supported hook) so the same
  process serves HTTP traffic and mail dispatch. For a production
  deployment with multiple Next.js instances behind a load balancer,
  the dispatcher uses a row-level `UPDATE … SET status = 'pending' …
  RETURNING id` advisory lock pattern that SQLite supports trivially
  (single-writer per database, fully serialised writes), so only one
  instance ever processes a given row.
- Recorded as [ADR-0023](./adr/0023-nodemailer-smtp-transport.md).

### Decision 2 — Diff strategy

**Resolution**: Server-side computation of a per-field diff using
the `diff ^5.2` npm package. `diffWordsWithSpace` powers prose
(title, description, free-text answers); `diffArrays` powers the
attachment-id list; structured answers (numbers, dates, booleans,
single/multi select) are reported as opaque `{ from, to }` pairs
because a word-level diff of a number is meaningless. The endpoint
returns a typed `IdeaDiff` (see data-model.md §4) so the UI can
render either side-by-side or unified without recomputing.

**Rationale**:

- Matches the user-provided default.
- `diff` is small (~30 KB), zero-dep, and well-trodden. The Jest /
  React ecosystem already relies on it transitively, so the lockfile
  footprint is minimal.
- Computing the diff server-side gives one canonical oracle for both
  the UI and the integration tests; the UI never has to re-implement
  diffing.
- `IdeaDiff` is rendered token-driven by `DiffViewer`, so the dark-
  mode requirement (FR-031) is satisfied by `--diff-add` /
  `--diff-remove` variables on `tokens.css`, not by per-component
  conditional styling.

**Alternatives considered**:

- `jsdiff` (same package, older name) — superseded.
- Custom Myers diff — reinventing for no gain.
- Client-only diff — every viewer pays the CPU cost; the snapshot
  payload would need to embed both versions even when the user is
  inspecting one; harder to integration-test.

**Implications**:

- Snapshots are stored **whole** (one row per version with all the
  editable fields), not as deltas, so the diff endpoint just hydrates
  two snapshots and diffs in memory. This keeps the write path
  obviously correct (no "rebuild from deltas" failure mode) at the
  cost of `O(versions × fields)` storage — bounded by the per-idea
  edit volume.
- Recorded as [ADR-0024](./adr/0024-version-history-and-diff-strategy.md).

### Decision 3 — Attachment preview rendering

**Resolution**: Browser-native preview only — `<img>` for raster
images; a sandboxed `<iframe>` against `/api/attachments/[id]/preview`
for PDF, plain text, markdown, and source code. Markdown is rendered
server-side to a constrained HTML subset (whitelisted tags only;
links are forced to `rel="noopener noreferrer" target="_blank"`); SVG
is **always** routed through the download fallback. Everything else
(`.docx`, `.pptx`, `.zip`, `.tar.gz`, unknown MIME) degrades to a
download card with name / size / type and a "Download" affordance.

**Rationale**:

- Matches the user-provided default.
- Avoids a new client-side preview library and the supply-chain risk
  it carries (PDF.js et al. ship ~1.5 MB of WASM and a wide attack
  surface). Modern Chromium and Firefox have built-in PDF viewers
  that work in an iframe with `Content-Disposition: inline`.
- Server-side response headers (`Content-Disposition: inline`,
  `Content-Security-Policy: sandbox`, `X-Content-Type-Options:
  nosniff`) plus the wrapping `<iframe sandbox>` enforce that even
  a hostile HTML attachment (intentionally mislabelled by the
  uploader) cannot reach the parent origin, fetch sub-resources,
  navigate the top frame, or execute scripts (NFR-006).

**Implications**:

- The "primary representation" metric for SC-005 counts a preview as
  "rendered" if the request returns 200 with the expected mime and
  the response headers above; the UI cannot observe a failure to
  render inside the browser's PDF viewer, so the SC measurement is
  server-side, which is the spec's stated intent.
- Recorded as [ADR-0025](./adr/0025-attachment-preview-sandbox.md).

### Decision 4 — In-app badge delivery

**Resolution**: Pure polling. The shared `AppShell` mounts a
`useNotifications()` hook that calls `GET /api/notifications?since=…`
every **60 s** while the tab is foregrounded, and pauses polling
when `document.visibilityState !== 'visible'` (resuming on
`visibilitychange`). The endpoint returns the unread count (cheap)
plus the 10 most-recent events for the dropdown (with anonymity
already applied per ADR-0018).

**Rationale**:

- Matches the user-provided default (no WebSocket / SSE / push).
- A 60 s cadence is well inside the user's mental model of "real
  time" for an internal portal and costs one indexed `COUNT(*)`
  query per user per minute — trivial at the spec's scale (≤ 1 000
  users).
- Pausing on `visibilitychange` keeps mobile battery drain at zero
  when the portal is backgrounded.
- Avoids the operational complexity of long-lived connections in a
  Next.js + SQLite deployment.

**Alternatives considered**:

- **Server-Sent Events / WebSocket** — overkill for a 60 s
  acceptable latency, and complicates the dev workflow (no
  hot-reload-friendly story for in-process SSE inside Next.js App
  Router).
- **Push notifications (Web Push)** — explicitly out of scope per
  spec Assumption.
- **No in-app badge, email-only** — fails FR-015 and SC-003.

**Implications**:

- Anonymity is applied at *enqueue* time when the `payload` JSON is
  written into `notification_events`, NOT at read time. This guards
  against future leakage if the recipient or the actor changes role
  between event and read.
- Recorded as [ADR-0026](./adr/0026-in-app-notification-polling.md).

### Decision 5 — Versioning shape

**Resolution**: Append-only whole-snapshot rows in `idea_versions`
(not deltas; not "EAV per field"). The initial submission is `v1`
(written in the same transaction as the `ideas` INSERT). Every
subsequent author edit writes `v(N+1)` inside the same transaction
as the `UPDATE`. Attachments are versioned by snapshotting the
ordered list of attachment ids; binary contents are never copied.

**Rationale**:

- Whole snapshots collapse a class of bugs ("rebuilding state from a
  partial delta chain") that has cost real time on real teams.
- The storage cost is bounded by author edit volume, not by reader
  traffic, and the spec's scale (≤ 10 000 ideas, modest edit volume)
  makes this comfortably tractable.
- Diffing two snapshots is a pure function of the two rows; this is
  the most-testable shape.
- Soft-deleting an attachment (via the existing storage path) does
  NOT mutate an `idea_versions` row — the snapshot continues to
  reference the (now-orphaned) attachment id, and the diff viewer
  renders it as `– filename.ext` on the next-version side.

**Alternatives considered**:

- Per-field history rows (EAV) — fast for "what changed when on
  field X" but pessimal for "render version N entirely".
- Delta-only — fragile, see above.

**Implications**:

- The migration back-fills `v1` for every existing idea and walks
  `status_transitions` for Phase-3 `EDITED` audit rows to recreate
  subsequent snapshots. Where the audit row is older than the
  Phase-3 snapshot format, the back-fill writes the *current* values
  with the audit row's timestamp — a coherent timeline rather than a
  byte-perfect reconstruction.

### Decision 6 — "Reviewer for this idea" set (FR-012)

**Resolution**: A reviewer for an idea is **any user who has
authored a non-deleted comment OR a recorded rating on that idea**.
Computed by the notification service as the SQL union of
`comments.author_id` (where `deleted_at IS NULL`) and
`ratings.evaluator_id` (where `score IS NOT NULL` OR
`locked_at IS NOT NULL`) for the given idea, with the actor of the
current event removed (a user does not get notified of their own
action).

**Rationale**:

- Matches the spec's Assumption that "the reviewer set" is
  observable from existing comment/rating tables and does not need a
  formal assignment model.
- A user who *only* viewed the idea is not notified — that would
  flood inboxes.

### Decision 7 — Bulk-transition digest (FR-017)

**Resolution**: When an Admin transitions multiple ideas in a single
request, the notification service writes ONE `BULK_DIGEST` event
per recipient covering all of that recipient's affected ideas, and
the email body lists the affected ideas as a bulleted list with the
old → new status per item. Individual per-event rows are NOT
written for the bulk path.

**Rationale**:

- Directly serves the FR-017 anti-spam intent.
- Keeps the dispatcher generic — it doesn't need to know about
  "bulk vs individual"; one event = one mail.

### Decision 8 — Anonymity in email + badge payload

**Resolution**: The notification service composes the `payload`
JSON at enqueue time by piping the underlying domain object
(comment, transition, rating) through the existing Phase-4
`maskAuthor`/`maskHistoryEvent` projection (ADR-0018), but always
in **reviewer-facing mode** when the recipient is in the reviewer
set, and **submitter-facing mode** when the recipient is the
author. The dispatcher renders the email body verbatim from
`payload`; it never re-derives names. The same `payload` powers
the in-app dropdown.

**Rationale**:

- Anonymity is a property of the stored event, not a property of
  the read path — exactly the same property the Phase-4
  projection guarantees for the UI, extended one layer outward.

## Open risks

- **SMTP relay availability in CI** — addressed by the recording
  fake transport at the adapter boundary. Integration tests never
  hit a real network.
- **PDF preview parity across browsers** — Chromium / Firefox /
  Safari all ship a built-in PDF viewer; the spec's three-browser
  baseline holds. Older Safari (< 16) is out of the support matrix
  per Phase-1 plan.
- **Polling at 60 s on the navigation chrome** — one COUNT query
  per active user per minute. Mitigated by the partial index on
  `(recipient_id) WHERE read_at IS NULL`.
- **Large diffs (> 200 KB prose)** — handled by `diff-service.ts`
  switching to paragraph-level diff above a threshold; the UI
  surfaces a "view full text" affordance per spec Edge Case.

## Output

All Decisions are pinned. No `NEEDS CLARIFICATION` left. Phase 1
can proceed.
