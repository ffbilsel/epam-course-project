# Feature Specification: Attachments, Version History & Notifications

**Feature Branch**: `005-attachments-history-notifications`  
**Created**: 14 May 2026  
**Status**: Draft  
**Input**: User description: "Multiple file attachments with in-portal preview. Send email when idea status changes or feedback is received. Track changes to ideas over time, show diff between versions."

## Overview

Features 001–004 delivered a coherent, role-aware idea pipeline with
smart forms, edit/listing/history tooling, multi-dimensional reviews,
comment threads, drafts, anonymous evaluation, dashboards, and a full
visual refresh with light/dark themes (ADR-0022 design tokens).

Three structural gaps remain between the portal and a "trustworthy
collaboration product":

1. **Attachments are anaemic.** An idea can carry a single file with no
   preview — reviewers download it, open it externally, then have to
   re-anchor to the portal. Most real proposals come with a diagram,
   a sample document, and a screenshot at minimum.
2. **The portal is silent.** Status changes, new comments, and new
   ratings happen in-app only; submitters and reviewers learn about
   them by visiting the site. Important decisions sit unread for days.
3. **Edit history is opaque.** Feature 003 records *that* an author
   edited an idea, but not *what* changed. When a reviewer returns to
   an idea after the author has revised it, they cannot see which
   fields moved, which forces a full re-read.

Feature 005 closes all three gaps with a single coordinated release:

- **Multiple attachments per idea with in-portal preview** (images, PDF,
  text/markdown, common office docs degrade gracefully).
- **Transactional email notifications** when an idea's status changes
  *or* when feedback (a new comment or a new rating) is recorded — with
  per-user preferences and per-event opt-out, respecting the anonymous
  evaluation model from feature 004.
- **Version history with a diff viewer** — every author edit captures a
  versioned snapshot (title, description, structured answers), and the
  detail page exposes a side-by-side / unified diff between any two
  versions, augmenting the existing History tab.
- **In-app notification badges** mirroring the email events for users
  who suppress mail but want a heads-up inside the portal.

Feature 005 is additive: the idea state machine, the role model, the
category lifecycle, the comment/rating model, the anonymity model
(ADR-0018), and the design-token system (ADR-0022) all remain in force.

**Dark mode is non-negotiable for this feature.** Every new UI surface
this feature introduces — the attachment manager, the in-portal preview
viewer, the version-history list, the diff viewer, the email
preferences page, and the in-app notification badges / dropdown — MUST
consume the shared Tailwind / CSS-variable design tokens established by
ADR-0022, render legibly in both `light` and `dark` themes with WCAG AA
contrast, and pick up theme changes without a page reload. No
hard-coded hex colours, no inline `style` props outside `src/components/
ui/` (Constitution VII.1).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Attach and preview multiple files on an idea (Priority: P1)

As an Employee submitting (or editing) an idea, I want to attach more
than one supporting file — a couple of screenshots, a one-page PDF, and
a markdown brief — and have reviewers see thumbnails / inline previews
of each one directly on the idea page, without leaving the portal.

**Why this priority**: This is the single most-requested change from
features 001–003 users. Today's "one file, download to view" is the
dominant friction in real review sessions.

**Independent Test**: An Employee opens a draft or `SUBMITTED` idea
they own, drags three files (a PNG, a PDF, a `.md`) into the attachment
zone, sees each upload progress, sees three preview cards appear, and
saves. A reviewer opens the idea, sees the same three preview cards,
clicks each in turn, sees the image inline, the PDF in an in-page
viewer, and the markdown rendered to HTML — never leaving the page.

**Acceptance Scenarios**:

1. **Given** I am editing my draft or `SUBMITTED` idea, **When** I drop
   multiple files into the attachment zone, **Then** each upload starts
   immediately, progress is shown per file, and each successful upload
   appears as a preview card on the form.
2. **Given** I have already attached files, **When** I remove one,
   **Then** it is removed from the idea, the underlying file is
   scheduled for deletion, and the remaining files keep their order.
3. **Given** an idea has image / PDF / text attachments, **When** any
   user with view rights opens the idea page, **Then** each attachment
   renders with an inline preview (thumbnail for images, embedded PDF
   viewer, syntax-aware text rendering) without a full download.
4. **Given** an attachment is an unsupported type (e.g. `.zip`),
   **When** I view the idea, **Then** a generic file card with name,
   size, type, and a "Download" affordance is shown instead of an
   inline preview — no error, no broken viewer.
5. **Given** the same idea is reopened on a different device, **When**
   the detail page loads, **Then** the order of attachments matches the
   order saved by the author.
6. **Given** an idea is in any post-`SUBMITTED` state, **When** I am not
   the author, **Then** I cannot add or remove its attachments,
   matching the edit-permission rules of feature 003.
7. **Given** I am in dark mode, **When** I open the attachment manager
   and the preview viewer, **Then** every surface (drop zone, cards,
   PDF chrome, code/markdown preview, error and empty states) uses the
   ADR-0022 tokens and meets WCAG AA contrast.

---

### User Story 2 — Email me when my idea moves or someone gives feedback (Priority: P1)

As an Employee whose idea is being evaluated, I want an email when its
status changes or when a reviewer leaves a new comment / rating — so I
don't have to log in repeatedly to find out where things stand.
Symmetrically, as a Reviewer assigned to (or following) an idea, I want
an email when the submitter replies in the thread.

**Why this priority**: This is the smallest change that makes the
portal feel "alive" outside its tab. Without it, drafts and threads
stall for days because nobody knows there's a turn waiting for them.

**Independent Test**: An Employee submits an idea, signs out, and is
not logged into the portal. A Reviewer (in another browser) transitions
the idea to `UNDER_REVIEW` and leaves a comment. Within a small window
(seconds in dev, see SC-002), the Employee receives two emails: one for
the status change and one for the new comment. The Employee opens
their email preferences page, switches off "comment notifications", and
a second comment from the Reviewer no longer triggers a mail (but the
in-app badge still appears).

**Acceptance Scenarios**:

1. **Given** I am the author of an idea, **When** its status transitions
   (`SUBMITTED → UNDER_REVIEW`, `→ APPROVED`, `→ REJECTED`, `→
   IMPLEMENTED`), **Then** I receive one email per transition with the
   idea title, the new status, the actor's role-appropriate display
   name (see anonymity rules below), and a deep link to the idea.
2. **Given** I am the author of an idea, **When** a reviewer adds a
   comment or a rating, **Then** I receive one email per event with a
   snippet of the comment (≤ 280 chars) or a summary of the rating
   (per-dimension scores), plus a deep link.
3. **Given** I am a reviewer who has commented on or rated an idea,
   **When** the submitter replies in the thread, **Then** I receive one
   email per new comment with a snippet and a deep link.
4. **Given** an idea is in **anonymous evaluation** mode (ADR-0018),
   **When** a notification email goes to a reviewer, **Then** the
   submitter's identity is not disclosed in the email body, subject,
   or headers; conversely, when a notification goes to the submitter,
   reviewer identities follow the same anonymity rule as in the UI.
5. **Given** I open my account / preferences page, **When** I toggle
   any of "Status changes", "New comments on my ideas", "Replies on
   ideas I review" off, **Then** the corresponding email category is
   suppressed for me — confirmed by no email being sent for the next
   such event.
6. **Given** the SMTP backend is unreachable or rejects a message,
   **When** the system tries to send a notification, **Then** the
   delivery is retried with backoff, surfaced in server logs, and the
   in-app event still fires — a failed email never blocks the
   underlying state transition or comment write.
7. **Given** I am in dark mode in the portal, **When** I open the email
   preferences page, **Then** every control (toggles, sectioning,
   description text, save / saved-state) uses ADR-0022 tokens and
   meets WCAG AA contrast.
8. **Given** I have any unread events while logged in, **When** I look
   at the navigation chrome, **Then** an in-app notification badge
   shows the unread count (capped display, e.g. `9+`), opening a
   dropdown of the same events that would have generated emails, in
   both light and dark modes.

---

### User Story 3 — See exactly what changed between versions of an idea (Priority: P2)

As a Reviewer who has already read an idea, when the author later
edits it, I want to see *what* changed (which fields, which words) so
I can re-read only the deltas. As the Author, I want the same view to
audit my own edit history.

**Why this priority**: Builds on Story 1 of feature 003 (Edit/Delete).
Without diffs, every edit forces a full re-read; with them, edits
become cheap and authors are more likely to refine before review.
Lower priority than P1 because read-only and doesn't gate the
workflow, but high-impact for review throughput.

**Independent Test**: An Employee submits an idea, edits the title,
description, and one structured answer, edits it again, then submits
the idea. A reviewer opens the idea, opens the History tab, sees three
version entries (v1 / v2 / v3) ordered chronologically with timestamps
and actors, clicks "Compare to current" on v1, and sees a unified diff
highlighting all changed fields with red/green word-level highlights
that read correctly in both light and dark themes.

**Acceptance Scenarios**:

1. **Given** an idea has been edited at least once by its author,
   **When** I open the History tab, **Then** I see a versioned list:
   `v1` (initial submission), `v2`, … `vN` (current), each with
   timestamp, actor display name, and a "View" / "Compare" affordance.
2. **Given** I click "View" on a past version, **When** it opens,
   **Then** I see a read-only rendering of that version's title,
   description, and structured answers as they were at that point in
   time (read-only; clearly labelled as historical).
3. **Given** I pick two versions to compare, **When** the diff renders,
   **Then** each changed field is shown with a unified or side-by-side
   diff (configurable per user, side-by-side is the default), with
   word-level red/green highlights on prose fields (title,
   description, free-text answers) and a "before → after" presentation
   on structured / non-text answers.
4. **Given** a field is unchanged between the two versions, **When**
   the diff renders, **Then** that field is collapsed by default with
   a "show unchanged fields" toggle to reveal it.
5. **Given** the idea has only ever had one version (no edits),
   **When** I open the History tab, **Then** the version list shows
   one entry (`v1`) and the diff controls are hidden — no empty diff.
6. **Given** an attachment was added or removed between two versions,
   **When** I diff them, **Then** the attachment list section shows
   `+ filename.ext` / `– filename.ext` markers; binary contents of
   attachments are not diffed.
7. **Given** I view a historical version or a diff, **When** I do so
   in dark mode, **Then** removed / added highlights, the side-by-side
   gutter, the version-list selection state, and every chrome element
   use ADR-0022 tokens and meet WCAG AA contrast for diff colours.
8. **Given** I am not allowed to view the idea (e.g. someone else's
   draft, role restrictions), **When** I try to access its history or
   diff endpoints directly, **Then** the request fails with the same
   not-found / forbidden semantics as the detail page, with no version
   leakage.

---

### Edge Cases

- **Attachment count / size cap** — a single idea must not be able to
  attach an unbounded number of files; a per-idea limit (default 10
  attachments, 25 MB each, 100 MB total) and per-user/hour upload rate
  limit are enforced server-side; the UI shows the remaining budget.
- **Mid-upload abandonment** — if the author leaves the form before
  saving, in-flight uploads are cancelled and any staged files are
  garbage-collected (the existing staged-attachment cleanup model).
- **Renamed / re-categorised idea mid-thread** — emails always carry
  the current title and a stable deep link; readers landing on a
  re-categorised idea see today's category, not the historical one.
- **Recipient deactivated** — if a target user is disabled / deleted
  between event and send, the queued mail is dropped and an in-app
  event is suppressed; no bounces are retried indefinitely.
- **Bulk transitions** — if an Admin bulk-transitions multiple ideas at
  once, recipients receive one digest email per author covering all of
  their ideas in that batch, not N separate mails (anti-spam).
- **Very large diffs** — for fields exceeding a threshold (e.g. 200 KB
  of prose), the diff viewer falls back to a per-paragraph diff with a
  "view full text" affordance to avoid pathological renders.
- **Concurrent edits** — versions are append-only; if two saves race,
  the second save creates `vN+2` rather than overwriting `vN+1`, and
  the diff list shows both.
- **Anonymous mode emails** — in anonymous evaluation mode, mails to
  the submitter never disclose the reviewer's name or email address,
  even via headers (`From:` uses a generic system identity, with the
  reviewer's display name redacted to "Reviewer").
- **Theme switch mid-view** — toggling light/dark while a preview /
  diff viewer is open re-themes the surface live; no reload required.

## Requirements *(mandatory)*

### Functional Requirements

**Attachments & preview**

- **FR-001**: An idea MUST support multiple attachments (default cap:
  10 files, 25 MB each, 100 MB total per idea). The single-attachment
  uniqueness constraint from feature 001 MUST be lifted.
- **FR-002**: The attachment manager MUST accept drag-and-drop and
  classic file-input uploads, show per-file progress, support reorder
  via drag, support per-file remove, and surface server-side validation
  errors (type, size, count) inline against the offending file.
- **FR-003**: The system MUST render in-portal previews for at least:
  PNG / JPEG / GIF / WEBP / SVG images; PDF documents; plain text /
  markdown / source code; and gracefully degrade unsupported types to
  a download card with name, size, and type.
- **FR-004**: Attachment edit permissions MUST match the idea edit
  permissions established by feature 003 (only the author, only while
  the idea is in `DRAFT` or `SUBMITTED`).
- **FR-005**: Stored attachment metadata MUST capture original
  filename, MIME type, byte size, uploader, upload timestamp, and a
  user-defined display order; the storage layer MUST keep filenames
  opaque on disk (continuing the feature-001 model).

**Email notifications & in-app badges**

- **FR-010**: The system MUST send a transactional email to the idea's
  author for every status transition of their idea.
- **FR-011**: The system MUST send a transactional email to the idea's
  author for every new comment or rating added by another user to
  their idea.
- **FR-012**: The system MUST send a transactional email to a
  reviewer (anyone who has commented on or rated the idea) when the
  submitter posts a new comment in the same thread.
- **FR-013**: Email content MUST respect the anonymity mode of the
  idea (ADR-0018): submitter identity is never revealed to reviewers
  in anonymous-mode mails, and vice-versa where applicable.
- **FR-014**: Each user MUST have an email-preferences page exposing
  granular toggles per event category (status, comments-on-my-ideas,
  ratings-on-my-ideas, replies-on-ideas-I-review). Defaults are ON.
- **FR-015**: Suppressed-email events MUST still produce an in-app
  notification badge entry; opening it from the badge dropdown MUST
  mark it read; an "Open" affordance MUST deep-link to the idea.
- **FR-016**: Failed email deliveries MUST be retried with exponential
  backoff and MUST NOT block the underlying domain write (state
  transition, comment, rating). Permanent failures MUST be logged with
  an error code and surfaced in admin server logs.
- **FR-017**: Bulk operations by Admin (e.g. multi-transition) MUST
  collapse per-recipient notifications into one digest mail per actor
  batch to prevent inbox flooding.
- **FR-018**: Outbound mails MUST carry a stable `List-Unsubscribe`
  header pointing at the in-app preferences page; the body MUST also
  carry a visible "Update preferences" link.

**Version history & diff viewer**

- **FR-020**: Every successful author edit to an idea (title,
  description, category, structured answers, attachment set) MUST
  create an immutable version record snapshotting the post-edit state
  with timestamp and actor. The initial submission counts as `v1`.
- **FR-021**: The idea detail page MUST expose, alongside the existing
  History tab, a "Versions" affordance listing every version of the
  idea with version number, timestamp, and actor.
- **FR-022**: Users MUST be able to view any past version as a
  read-only rendering of the form (title, description, structured
  answers) as it was at that time.
- **FR-023**: Users MUST be able to select any two versions (or "this
  vs current") and see a diff per field, with word-level highlights
  for prose fields and "before → after" for structured / non-text
  fields. Unchanged fields are collapsed by default.
- **FR-024**: Attachments MUST be diffed at the file-list level
  (`+filename` / `–filename`); binary content MUST NOT be diffed.
- **FR-025**: Access to a version / diff MUST follow the same
  authorisation rules as the idea detail page; unauthorised access
  MUST return the same not-found / forbidden response — no version
  metadata leakage.

**Dark-mode UI compliance (Constitution VII.1 + ADR-0022)**

- **FR-030**: Every new UI surface introduced by this feature — the
  attachment manager, the in-portal preview viewer, the version-list,
  the diff viewer, the email-preferences page, and the in-app
  notification badge / dropdown — MUST consume the ADR-0022 CSS-
  variable design tokens; no hard-coded hex colours or `style` props
  outside `src/components/ui/` are permitted.
- **FR-031**: Each new UI surface MUST render correctly in both
  `light` and `dark` themes, including diff red/green highlights, PDF
  preview chrome, code/markdown rendering, and notification badges.
- **FR-032**: Each new UI surface MUST meet WCAG AA contrast in both
  themes (text vs background ≥ 4.5:1; UI / focus ≥ 3:1).
- **FR-033**: Toggling the theme while any new surface is open MUST
  re-theme the surface live without a page reload.

### Non-Functional Requirements

- **NFR-001 (Performance)**: Attachment preview rendering MUST start
  within 1.5s of opening the idea page for files ≤ 5 MB on the project
  baseline machine.
- **NFR-002 (Delivery latency)**: ≥ 95% of notification emails MUST be
  dispatched within 30 seconds of the triggering event in production
  configuration.
- **NFR-003 (Reliability)**: A failed email delivery MUST NOT roll back
  the originating database transaction (state change / comment /
  rating); email send is a separate, retried side effect.
- **NFR-004 (Storage)**: Version snapshots MUST be retained for the
  life of the idea; deleting an idea (feature 003) MUST also delete
  its version snapshots, attachments, and queued notifications.
- **NFR-005 (Accessibility)**: All new surfaces MUST be keyboard-
  operable, screen-reader-labelled, focus-trapped where applicable
  (modal preview), and pass automated axe-core checks on the chosen
  baseline (no new criticals).
- **NFR-006 (Security)**: Email bodies MUST NOT include attachment
  contents or arbitrary user-supplied HTML; previews MUST render
  user-uploaded SVG and markdown with a hardened sanitiser (no script,
  no on-handlers, no external links auto-loaded).

### Key Entities

- **Attachment** — Multiple per idea (1..N), ordered. Carries original
  filename, MIME type, byte size, uploader, created-at, display
  order. Files live on disk with opaque ids (continuation of feature
  001 model).
- **IdeaVersion** — Append-only snapshot of an idea's editable fields
  (title, description, category, structured answers, attachment-id
  list) produced on every author edit. Has version number, actor,
  created-at, link to parent idea.
- **NotificationEvent** — An in-system event row (status-change /
  comment-added / rating-added / reply-on-review) with recipient,
  actor, idea reference, payload snippet, created-at, read-at.
- **EmailDelivery** — One row per outbound mail attempt referencing a
  NotificationEvent. Carries status (`pending` / `sent` / `failed` /
  `suppressed`), attempt count, last error, last-attempt-at.
- **EmailPreference** — Per-user toggles for each event category
  (status / comments-on-my-ideas / ratings-on-my-ideas / replies-on-
  ideas-I-review). Defaults ON.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001 (Attachments adoption)**: Within 30 days of release, ≥ 40%
  of newly submitted ideas carry more than one attachment.
- **SC-002 (Email latency)**: ≥ 95% of notification emails are
  delivered (per SMTP `sent` confirmation) within 30 seconds of the
  triggering event under normal load.
- **SC-003 (Re-engagement)**: Median time-to-first-author-reply on a
  reviewer comment drops by ≥ 50% versus the four-week baseline
  immediately before release.
- **SC-004 (Diff usefulness)**: ≥ 75% of reviewers who land on an
  idea that has been edited since their last visit use the diff
  viewer in that session, measured via in-app event logging.
- **SC-005 (Preview success)**: ≥ 95% of attachment preview opens
  render their primary representation (image / PDF / text) without
  falling back to the download card, measured server-side.
- **SC-006 (Dark-mode coverage)**: 100% of new UI surfaces pass the
  repo's `check-ui-tokens` script and automated axe-core contrast
  checks in both `light` and `dark` themes — zero violations gate
  release.
- **SC-007 (No regressions)**: Existing feature 001–004 happy-path
  E2E tests pass unchanged on the merged branch.

## Assumptions

- Email infrastructure is delivered as an SMTP relay configured via
  environment variables (no third-party transactional-mail SaaS in
  scope); the application talks SMTP directly.
- The portal continues to ship without push notifications (web push /
  mobile); in-app badges + email are the only out-of-tab channels.
- Markdown/source-code preview uses the same sanitiser stack already
  vetted for the comment editor in feature 004 (no new dependency
  evaluation needed in this feature).
- The `attachments` table's single-attachment uniqueness from feature
  001 can be migrated away (drop the unique index, keep the foreign
  key) without data loss; legacy rows become the first attachment of
  their idea.
- Existing edit-history rows from feature 003 are back-filled into
  `IdeaVersion` records at migration time so that historical ideas
  show a coherent version list starting at `v1`.
- The "reviewer for this idea" set (for FR-012's reply-on-review
  mails) is defined as "anyone who has posted a comment or a rating
  on the idea", which subsumes assignment without requiring a formal
  assignment model.
- Anonymity mode (ADR-0018) covers email recipient identity by
  reusing the same display-name resolution logic — no separate email
  anonymity policy is introduced.
- Mobile UX is in scope only insofar as the makeover from feature 004
  already supports it; no mobile-specific surfaces are added.
