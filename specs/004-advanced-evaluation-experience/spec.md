# Feature Specification: Advanced Evaluation Experience

**Feature Branch**: `004-advanced-evaluation-experience`  
**Created**: 14 May 2026  
**Status**: Draft  
**Input**: User description: "Add charts showing submission trends, approval rates, category distribution and make a total frontend makeover. Save and edit drafts before submission. Anonymous evaluation mode. 1-5 rating dimensions for evaluations. Comment Threads. Allow back-and-forth discussion between submitter and evaluators."

## Overview

Features 001–003 delivered the core InnovatEPAM Portal: role-based idea
submission with attachments, category-aware smart forms, and listing /
edit / history / export tooling. The portal now has enough live data and
day-to-day usage that two structural gaps are blocking the next jump in
quality:

1. **Decisions are opaque.** Reviewers approve or reject with a single
   free-text comment, and submitters have no way to ask "why?" or to push
   back. There is no quantitative signal on *how good* an idea is across
   the dimensions the business actually cares about (feasibility, impact,
   originality, …), only a binary verdict. Leadership has no at-a-glance
   view of submission volume, approval rates, or category mix.
2. **The submission funnel is leaky.** Employees cannot save work in
   progress; closing the tab loses everything. Reviewers' identities are
   always visible to submitters and vice-versa, which discourages candid
   evaluation in politically sensitive cases.

Feature 004 closes both gaps with a single coordinated release:

- **Insight dashboards** (charts for submission trends, approval rates,
  category distribution) for Admins, with a role-appropriate subset for
  Reviewers and Employees.
- **A drafts lifecycle** so employees can save and edit a partial
  submission before it ever enters review.
- **Anonymous evaluation mode**, a per-idea / per-category toggle that
  hides submitter identity from reviewers during evaluation.
- **Multi-dimensional 1–5 ratings** on each evaluation, with category-
  configurable rating criteria.
- **Comment threads** that allow back-and-forth discussion between the
  submitter and the assigned reviewer(s) on each idea, replacing today's
  single decision-comment.
- **A full frontend makeover** that modernises the visual language of the
  portal (typography, colour, spacing, component density, dark mode,
  accessibility) and weaves the new capabilities into a coherent UI.

Feature 004 is additive to features 001–003: the state machine
(`SUBMITTED → UNDER_REVIEW → APPROVED/REJECTED → IMPLEMENTED`), the role
model (`employee` / `reviewer` / `admin`), the category lifecycle, and
the attachment/edit/history/export rules all remain in force.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Employee saves and edits a draft idea before submitting (Priority: P1)

As an Employee starting a substantial idea, I want to fill out part of
the smart form, save it as a draft, walk away, and come back later (from
the same machine or another) to finish and submit it — without ever
exposing the half-baked version to reviewers.

**Why this priority**: Loss-of-work is the single largest friction in
moving from "quick idea" to "considered proposal". Drafts unlock longer,
better-thought-out submissions and are a prerequisite for the
back-and-forth tone the rest of feature 004 enables.

**Independent Test**: An Employee opens the new-idea form, fills the
title and partial answers for a category, clicks "Save draft", closes
the browser, logs back in later, opens "My Drafts", clicks the draft,
edits a couple of fields, and clicks "Submit". The idea then appears in
the reviewer queue in `SUBMITTED` state with the final values; the draft
is consumed (no longer in "My Drafts"). At no point does the draft
appear in any reviewer or admin listing.

**Acceptance Scenarios**:

1. **Given** I am authoring a new idea, **When** I click "Save draft" with
   any (even empty) fields, **Then** the system persists my current
   values as a `DRAFT`, returns me to my own "My Drafts" list, and the
   draft does **not** show up in any reviewer queue, admin listing, or
   in the public idea count.
2. **Given** I have a saved `DRAFT`, **When** I reopen it, **Then** the
   form pre-fills with every value I saved (title, description,
   category, structured answers, attachment metadata), and I can edit
   any field — including swapping the category, which behaves exactly as
   on a brand-new form per feature 002.
3. **Given** I am editing a `DRAFT`, **When** I click "Save draft" again,
   **Then** the existing draft is updated in place (not duplicated).
4. **Given** I am editing a `DRAFT`, **When** I click "Submit" and all
   required fields are valid, **Then** the draft transitions to
   `SUBMITTED`, an `idea` row is created (or the existing one is
   updated, see Assumptions), it appears in the reviewer queue, and the
   draft no longer appears in "My Drafts".
5. **Given** I have a `DRAFT`, **When** I click "Delete draft", **Then**
   the draft and any draft-only attachment are removed and I see a
   confirmation; no audit trail is exposed to other users because the
   idea never existed for them.
6. **Given** I attempt to view a `DRAFT` I do not own, **When** I hit its
   URL directly, **Then** the system responds with not-found (drafts are
   strictly private to their author).

---

### User Story 2 — Reviewer scores an idea on multiple 1–5 dimensions and discusses it (Priority: P1)

As a Reviewer, I want to evaluate an idea against several criteria
(e.g. feasibility, impact, originality, alignment) on a 1–5 scale rather
than just up-or-down, and I want to be able to ask the submitter
clarifying questions in a threaded conversation before I commit to a
decision.

**Why this priority**: Multi-dimensional scoring plus discussion is what
turns the portal from a "yes/no inbox" into a real evaluation tool. It
also feeds Story 4's charts (approval *rate* gets richer when paired
with average scores per dimension).

**Independent Test**: A Reviewer opens an idea, sees a panel with the
rating dimensions configured for that idea's category, sets each
dimension to a value 1–5, posts a comment ("Can you clarify the rollout
timeline?"), the submitter sees the comment on their own detail page,
replies inline ("Q2 2026, after the migration"), the Reviewer adjusts
one of the scores, and finally clicks Approve. The idea moves to
`APPROVED`; the per-dimension scores, the full thread, and the final
decision comment are all persisted and visible on the detail page.

**Acceptance Scenarios**:

1. **Given** I am a Reviewer and have started review on an idea (it is
   `UNDER_REVIEW`), **When** I view its detail page, **Then** I see a
   rating panel listing each dimension configured for the idea's
   category, each with a 1–5 selector (with an explicit "unrated"
   state) and a short tooltip explaining the dimension.
2. **Given** I set values on one or more dimensions, **When** I save the
   evaluation (or it auto-saves), **Then** the values are persisted
   against my evaluator identity and shown on the idea detail page as
   *my* scores (other reviewers' scores remain attributed to them).
3. **Given** at least one rating dimension is configured as required for
   the category and I have not set a value for it, **When** I click
   Approve or Reject, **Then** the decision is rejected with a clear
   per-dimension validation message and the idea status does not
   change.
4. **Given** I am viewing an idea, **When** I post a comment in the
   thread, **Then** the comment is recorded with my display name, my
   role badge, and a timestamp, and it appears immediately on the
   thread for me and on subsequent loads for everyone permitted to view
   the idea.
5. **Given** the submitter has posted a comment on their own idea,
   **When** I open the detail page, **Then** I see their comment in
   the thread in chronological order, distinguishable by their author
   badge.
6. **Given** the comment thread, **When** I or another participant
   replies to a specific comment, **Then** the reply renders nested
   under its parent (one level of nesting is sufficient) so the
   discussion structure is preserved.
7. **Given** I finalise my decision (Approve or Reject), **When** the
   idea transitions, **Then** my per-dimension scores are frozen for the
   decision record (locked from further edits) and the decision comment
   is recorded as a final thread message tagged "decision".

---

### User Story 3 — Anonymous evaluation hides the submitter's identity from reviewers (Priority: P2)

As an Admin (or in some deployments, as a Submitter), I want certain
ideas — or all ideas within a sensitive category — to be evaluated
anonymously: the reviewer sees the idea, the category, the answers, and
the attachment, but not the submitter's name, email, or any signal that
would identify them. The submitter still sees the reviewer.

**Why this priority**: Anonymous evaluation is a strong fairness signal
that meaningfully changes reviewer behaviour on sensitive ideas; it is
P2 (not P1) because it depends on the comment / rating UI from Story 2
already being in place to be useful.

**Independent Test**: An Admin marks the "Diversity & Inclusion"
category as anonymous (or flips the per-idea toggle on a specific
idea). An Employee submits an idea in that category. A Reviewer opens
the idea: the author panel reads "Anonymous Submitter" with no email,
no avatar, and no link-through to a profile, the History tab masks the
submitter's identity in the `SUBMITTED` and any `EDITED` events, and
the comment thread shows the submitter's posts as "Anonymous
Submitter". The submitter, on their own detail page, still sees the
Reviewer's identity normally. After a decision, an Admin viewing the
audit log can still see who submitted (anonymity is to reviewers, not
to the system).

**Acceptance Scenarios**:

1. **Given** a category is configured as `anonymous_evaluation = true`,
   **When** an Employee submits an idea in that category, **Then** every
   reviewer-facing surface (queue, detail page, comment thread, history
   tab) masks the author as "Anonymous Submitter" with no identifying
   information.
2. **Given** an idea is flagged anonymous (either by category default or
   by a per-idea admin override), **When** the submitter views their own
   idea, **Then** they see their own identity normally and they see the
   reviewer's identity normally — anonymity is one-way (reviewer cannot
   see submitter).
3. **Given** an idea is anonymous, **When** the submitter posts in the
   comment thread, **Then** their post is attributed to "Anonymous
   Submitter" for reviewers and to the submitter's real name for the
   submitter themselves.
4. **Given** a reviewer is reviewing an anonymous idea, **When** they
   post in the thread, **Then** their identity is shown normally to
   everyone (only the submitter's identity is masked).
5. **Given** an Admin opens an idea, **When** the idea is anonymous,
   **Then** the Admin sees the real submitter identity (Admins have a
   moderation responsibility and need the truth; anonymity is for
   reviewers).
6. **Given** the system records a status transition or audit event for
   an anonymous idea, **When** a reviewer reads the history tab, **Then**
   the submitter-related events render as "Anonymous Submitter" while
   reviewer-related events show real names.
7. **Given** an Admin toggles anonymity off on a specific idea, **When**
   reviewers reload, **Then** the submitter identity becomes visible to
   them on subsequent views (already-cached pages eventually catch up;
   no historical comments are retroactively renamed beyond what the
   current view computes).

---

### User Story 4 — Admin sees portal-wide insight dashboards (Priority: P2)

As an Admin (and to a lesser extent as a Reviewer), I want a dashboard
that visualises submission trends over time, approval rates, and
category distribution, so I can answer "is the portal healthy?" without
running ad-hoc SQL or exporting CSVs.

**Why this priority**: Insight charts are high-value once the data has
enough volume and once Story 2's per-dimension scores exist (richer
charts), but they are not blocking day-to-day reviewer work — hence P2.

**Independent Test**: An Admin opens the new "Insights" page and sees
three charts: a time-series of submissions per day/week/month, a
status-breakdown showing approval/rejection rate, and a category-share
chart. Switching the time range (last 7 days / 30 days / quarter /
custom) re-renders all three charts. Hovering each bar/segment shows
exact counts. A Reviewer who opens the page sees a role-appropriate
subset (e.g., approval rate and trend, but not org-wide volume by
author). An Employee does not see the Insights page at all.

**Acceptance Scenarios**:

1. **Given** I am an Admin on the Insights page with a chosen time range,
   **When** the page loads, **Then** I see a *Submission Trend* chart
   plotting count of `SUBMITTED` ideas per bucket (day, week, or month)
   over the range.
2. **Given** I am an Admin on the Insights page, **When** I view the
   *Approval Rate* chart, **Then** I see, for the same range, the share
   of decided ideas (i.e. `APPROVED + REJECTED`) that ended in
   `APPROVED`, broken out either as a single percentage or as a
   trend-over-time depending on chart type.
3. **Given** I am an Admin on the Insights page, **When** I view the
   *Category Distribution* chart, **Then** I see the share of submissions
   in each `ACTIVE` category for the range, summing to 100 %.
4. **Given** the Insights page, **When** I change the time range, **Then**
   all three charts refresh consistently against the new range.
5. **Given** I am a Reviewer (not Admin), **When** I open Insights,
   **Then** I see the charts but they exclude individually-attributable
   data (no per-submitter counts); I never see Employees' names listed
   as data points.
6. **Given** I am an Employee, **When** I attempt to open Insights,
   **Then** I am redirected (or see a forbidden page) — Employees do not
   have access to portal-wide analytics.
7. **Given** any chart, **When** I hover a bar/point/segment, **Then** I
   see the exact numeric value and (where relevant) the absolute count
   so the chart is never decoration-only.
8. **Given** any chart, **When** there is no data in the chosen range,
   **Then** the chart shows an explicit empty state rather than an
   ambiguous flatline.

---

### User Story 5 — The portal looks and feels modern across every page (Priority: P2)

As any user, I want the portal to look like a 2026 product, not a 2010
intranet form: legible typography, generous spacing, clear hierarchy,
proper dark mode, accessible colour contrast, consistent icons and
buttons, and a recognisable layout chrome across every page.

**Why this priority**: The makeover is the visible carrier of the
feature 004 release. It must ship with the rest of the work to land
coherently, but on its own it does not deliver new behaviour, hence P2.

**Independent Test**: A user navigates every primary page — sign-in,
home, new-idea form (incl. drafts), idea detail (incl. rating panel and
comment thread), my-ideas, queue, history, admin pages, insights — and
the pages share a single design system: typography scale, colour
palette, button styles, form controls, table/list styles, empty states,
and toast/notification style are all consistent. The portal passes
WCAG AA contrast checks in both light and dark mode.

**Acceptance Scenarios**:

1. **Given** any page of the portal, **When** I render it, **Then** the
   page uses the new design tokens (typography, spacing scale, colour
   palette, radius scale, elevation) — there are no surviving legacy
   styles from features 001–003.
2. **Given** I toggle dark mode (manual switch or OS preference),
   **When** I move between pages, **Then** every page renders correctly
   in dark mode without low-contrast text and without flashes of the
   wrong theme on navigation.
3. **Given** the new layout chrome (top navigation + role-aware
   sidebar), **When** I navigate between pages, **Then** the chrome stays
   in place, the active section is highlighted, and primary actions for
   the current page are surfaced in a consistent location.
4. **Given** any form (sign-in, new idea, draft, evaluation, admin
   category editor, etc.), **When** I interact with controls, **Then**
   labels, placeholders, error states, and focus rings are visually
   consistent across the portal.
5. **Given** any data table or list (My Ideas, queue, history, drafts),
   **When** I open it, **Then** it shares the same row density, sort/
   filter controls, pagination control, and empty-state pattern.
6. **Given** any page, **When** an automated accessibility scan runs,
   **Then** there are no WCAG AA contrast or labelling violations
   introduced by feature 004; keyboard navigation reaches every
   interactive control in a sensible order.
7. **Given** the design system, **When** a developer adds a new page,
   **Then** they can build it from the same library of shared
   components without inventing one-off styles (verified by the
   resulting code reusing the component library).

---

### Edge Cases

- An employee saves a draft, then the admin deactivates the category
  they had selected. On reopening the draft, the form prompts them to
  pick a new category; the previous category's structured answers are
  retained where the keys overlap and discarded otherwise (matching
  feature 002 behaviour).
- An admin re-configures a category's rating dimensions (adds, removes,
  or renames) **after** some ideas in that category have already been
  rated. Previously recorded scores are preserved against their old
  dimension labels; new dimensions appear unrated; removed dimensions
  are read-only and labelled "(deprecated)" on past decisions.
- A reviewer opens an idea, sets some scores, posts a comment, and then
  loses their reviewer role before deciding. On the next page load the
  rating panel and comment composer are disabled; their already-saved
  scores and comments remain on the record but cannot be modified.
- Two reviewers post comments concurrently on the same idea. Both
  comments are persisted; their order is determined by server-side
  timestamps and the thread reconciles on the next render without
  losing either comment.
- An admin toggles a category from anonymous to non-anonymous (or vice
  versa). Existing ideas in that category keep whatever anonymity flag
  they were created under (anonymity is a property of the idea, not
  recomputed from the category at view time).
- A reviewer attempts to game anonymous mode by quoting the submitter's
  identity in a comment they themselves post. This is treated as a
  social/governance problem, not a system one; the system does not
  attempt to redact reviewer-authored content.
- An employee posts a comment on their own idea **after** a decision has
  been made (`APPROVED` / `REJECTED` / `IMPLEMENTED`). Comments remain
  permitted as a post-decision discussion record, but no further
  scores can be edited and no further state transitions are triggered
  by comments.
- An idea is deleted (per feature 003, only while `SUBMITTED`); its
  drafts, scores, and comments are deleted with it.
- An admin requests Insights for a range with zero matching ideas: each
  chart renders its empty state independently rather than showing the
  page as broken.
- A user with a very large draft (lots of structured answers + the
  feature 001 attachment) saves repeatedly in quick succession; the
  system debounces / coalesces saves and never loses the most recent
  content.

## Requirements *(mandatory)*

### Functional Requirements

#### Drafts (Story 1)

- **FR-001**: The system MUST allow an authenticated Employee to save an
  in-progress idea as a `DRAFT`, including any subset of the core fields
  (title, description, category) and any subset of the category-specific
  structured answers from feature 002.
- **FR-002**: Drafts MUST be strictly private to their author: no other
  role (including Reviewer and Admin) can list, view, or act on another
  user's draft.
- **FR-003**: Drafts MUST NOT appear in any reviewer queue, admin
  listing, history, comment thread, evaluation surface, insight chart,
  or CSV export — they are not yet ideas in the lifecycle sense.
- **FR-004**: The author MUST be able to reopen and edit any of their own
  drafts at will (no time limit). Edits MUST update the existing draft
  rather than creating duplicates.
- **FR-005**: The author MUST be able to delete a draft; deletion MUST
  remove the draft row and any draft-only attachment.
- **FR-006**: Submitting a draft MUST run the same validation as a
  brand-new submission (required core fields + required category
  fields), transition it into the `SUBMITTED` lifecycle state, and stop
  it from appearing in "My Drafts".
- **FR-007**: The system MUST surface a "My Drafts" entry point for
  Employees and reflect the number of drafts the user currently holds.
- **FR-008**: Attachments uploaded against a draft MUST follow the same
  size and type rules as live attachments (per feature 001). Draft
  attachments MUST be cleaned up when the draft is deleted or submitted.

#### Multi-dimensional ratings (Story 2)

- **FR-009**: Each category MUST be configurable with an ordered list of
  rating dimensions, each with a short label, an optional description /
  tooltip, and a flag indicating whether a score is required before a
  decision can be recorded.
- **FR-010**: The system MUST ship with a sensible default set of rating
  dimensions (e.g. *Feasibility*, *Impact*, *Originality*, *Alignment*)
  applied to all `ACTIVE` categories that do not override them.
- **FR-011**: For every idea that has reached `UNDER_REVIEW`, the system
  MUST allow each assigned Reviewer (and any Admin acting as a
  reviewer) to record a 1–5 integer score on each dimension. A
  dimension MAY also be left explicitly `unrated`.
- **FR-012**: Reviewers MUST be able to revise their own scores up
  until the moment they (or another reviewer) finalise the decision.
  After Approve or Reject, that reviewer's scores for that idea MUST
  become read-only.
- **FR-013**: A decision (Approve / Reject) MUST be rejected if any
  rating dimension marked as required for that idea's category has no
  recorded score from the deciding reviewer.
- **FR-014**: The idea detail page MUST show each reviewer's per-
  dimension scores attributed to that reviewer (reviewer identity is
  always visible to the submitter; reviewer scoring of anonymous
  submitters does not hide the reviewer's identity).
- **FR-015**: The system MUST expose, in a read-only form, average and
  per-dimension breakdowns for any idea that has been decided, to
  support the Insights charts (Story 4) and the history tab.

#### Comment threads (Story 2)

- **FR-016**: Every idea (in any post-draft status) MUST have a comment
  thread visible to its author, to any assigned reviewer, and to all
  Admins. No other role/user MUST be able to view that idea's thread.
- **FR-017**: Participants MUST be able to post top-level comments and
  one level of replies (replies to top-level comments). Deeper nesting
  is out of scope for v1.
- **FR-018**: Each comment MUST record its author, the role at time of
  posting, a timestamp, and the text content; the content MUST support
  basic line breaks but MUST NOT permit raw HTML/JS injection.
- **FR-019**: The decision comment recorded at Approve / Reject MUST be
  posted into the thread as a comment tagged "decision" so that
  history and discussion live in the same place.
- **FR-020**: A user MUST be able to edit or delete their own comment
  within a short grace period (e.g. 5 minutes) but MUST NOT be able to
  edit or delete others'; an Admin MAY delete any comment for
  moderation (deletion is soft: the slot shows "[comment removed by
  moderator]" so the conversation remains coherent).

#### Anonymous evaluation (Story 3)

- **FR-021**: Each category MUST carry an `anonymous_evaluation` flag
  (default off). At submission time, the system MUST also honour a
  per-idea override that lets Admins (and per project configuration,
  Submitters) opt this specific idea into anonymous evaluation
  regardless of the category default.
- **FR-022**: Anonymity MUST be one-way: the Reviewer cannot see the
  Submitter (name, email, avatar, profile link) anywhere — in the
  queue, on the detail page, in the comment thread, or in the history
  tab — while the Submitter and any Admin sees real identities
  normally.
- **FR-023**: Anonymity MUST be a property of the idea at the moment of
  submission. Subsequent changes to the category's `anonymous_evaluation`
  flag MUST NOT retroactively change the anonymity of already-existing
  ideas (Admins MAY explicitly toggle a per-idea override; that
  override is what the UI reflects from then on).
- **FR-024**: Admins MUST always be able to see the real submitter
  identity (for moderation, abuse handling, and audit), regardless of
  the anonymity flag. The audit log MUST retain the real submitter
  identity on every event for an anonymous idea.

#### Insight dashboards (Story 4)

- **FR-025**: The system MUST expose an Insights page to Admins (full
  view) and to Reviewers (restricted view that excludes
  individually-attributable data). Employees MUST NOT have access.
- **FR-026**: The Insights page MUST render a *Submission Trend* chart
  plotting the count of `SUBMITTED` ideas in each time bucket (day,
  week, or month, chosen by the user) over the selected range.
- **FR-027**: The Insights page MUST render an *Approval Rate* chart
  computing, over the selected range, the proportion of decided ideas
  (`APPROVED + REJECTED`) that ended in `APPROVED`. The chart MAY be
  rendered as a single KPI plus a trend-over-time series.
- **FR-028**: The Insights page MUST render a *Category Distribution*
  chart showing the share of submissions in each `ACTIVE` category for
  the selected range, summing to 100 % of submissions in range.
- **FR-029**: The Insights page MUST support a range selector with at
  least these presets: last 7 days, last 30 days, current quarter,
  current year, and a custom from/to range.
- **FR-030**: Every chart MUST expose exact numeric values on hover and
  MUST render an explicit empty state when its data set is empty for
  the chosen range, so the user is never left guessing.
- **FR-031**: Insight queries MUST honour the anonymity rule (Reviewer
  view never reveals submitter identities) and the role-scope rule
  (Reviewer-restricted view shows aggregate-only data).

#### Frontend makeover (Story 5)

- **FR-032**: The portal MUST adopt a single design system covering
  typography, colour, spacing, radius, elevation, focus, and motion
  tokens; all primary pages (sign-in, home, new-idea, drafts, idea
  detail, my-ideas, queue, history, admin pages, insights) MUST be
  re-skinned to use these tokens — no page MUST retain pre-makeover
  styles.
- **FR-033**: The portal MUST provide a working light + dark mode
  toggled by the user (with OS preference as the default), with WCAG
  AA contrast in both modes.
- **FR-034**: The portal MUST share a single layout chrome (top
  navigation + role-aware sidebar / role-aware quick actions) across
  all authenticated pages; the active section MUST be visually
  highlighted.
- **FR-035**: Form controls, buttons, tables, lists, empty states, and
  toasts MUST be expressed as reusable components and used uniformly
  across the portal (no one-off styles for the new feature 004
  surfaces, no surviving one-off styles from features 001–003).
- **FR-036**: All interactive controls MUST be reachable and operable
  via keyboard alone, with visible focus indicators, descriptive
  labels, and ARIA semantics where appropriate.

### Non-Functional Requirements

- **NFR-001 (Performance — Insights)**: Each chart on the Insights page
  MUST render its initial data within 2 seconds for datasets up to
  10 000 ideas on a single modest server. Re-rendering on a range
  change MUST not block the rest of the page.
- **NFR-002 (Performance — Drafts and ratings)**: Saving a draft, saving
  a per-dimension score, and posting a comment MUST each complete with
  a server-acknowledged response in under 500 ms at the 95th
  percentile, so the UX feels instant.
- **NFR-003 (Privacy — Anonymity)**: When an idea is anonymous, no API
  response served to a Reviewer (queue, detail, thread, history, chart
  tooltip) MUST contain the submitter's name, email, user id, avatar
  URL, or any field derived from them. Anonymity MUST be enforced
  server-side, not only in the UI.
- **NFR-004 (Privacy — Drafts)**: Drafts MUST never appear in any
  endpoint that is not scoped to their owning Employee, including
  aggregate counts and the Insights charts.
- **NFR-005 (Accessibility)**: All new and re-skinned surfaces MUST pass
  automated WCAG AA contrast checks and MUST be keyboard-navigable
  end-to-end. The portal MUST respect `prefers-reduced-motion`.
- **NFR-006 (Compatibility)**: All feature 004 changes MUST be
  backwards-compatible with stored data from features 001–003:
  pre-existing ideas, categories, attachments, structured answers,
  status transitions, and the existing CSV export MUST keep working
  unchanged.
- **NFR-007 (Security)**: Comment content MUST be stored as plain text
  and rendered with HTML/JS injection prevented (no raw HTML execution,
  no XSS surface introduced).
- **NFR-008 (Auditability)**: Anonymous mode MUST be auditable — the
  audit log retains the real actor for every action on an anonymous
  idea, and Admin views surface the real identity.

### Dependencies on prior features

- **Feature 001 — InnovatEPAM Portal MVP**: Reuses the authentication
  (NextAuth-based) and role model (`employee` / `reviewer` / `admin`).
  Reuses the attachment service for draft and submitted attachments.
  Reuses the idea state machine (`SUBMITTED → UNDER_REVIEW → APPROVED /
  REJECTED → IMPLEMENTED`) and the audit log for status transitions.
- **Feature 002 — Smart Submission Forms**: Drafts MUST persist and
  re-display category-specific structured answers; the rating
  dimensions and the `anonymous_evaluation` flag attach to the same
  category entity introduced in feature 002.
- **Feature 003 — Idea Listing & Management**: The "My Drafts" surface
  reuses the listing pattern, pagination, and filter UI from feature
  003; the history tab from feature 003 is extended with the new event
  kinds introduced here (`DRAFT_SAVED`, `DRAFT_SUBMITTED`,
  `RATING_RECORDED`, `COMMENT_POSTED`, `DECISION` — anonymised where
  applicable); the CSV export from feature 003 MAY be extended later
  but is not required to change in v1 of feature 004.

### Key Entities *(include if feature involves data)*

- **Draft** — a private, author-only work-in-progress idea. Holds the
  same shape of fields as an in-flight idea (title, description,
  category, structured answers, optional attachment) plus
  `author_id`, `created_at`, `updated_at`. Becomes an Idea on submit
  (or is hard-deleted on cancel).
- **Rating Dimension** — a labelled criterion attached to a category
  (e.g. *Feasibility*). Carries: label, optional description, order,
  required-for-decision flag, active flag.
- **Rating** — a single 1–5 integer score (or `unrated`) recorded by
  one Reviewer against one idea's one Rating Dimension, with timestamp
  and a "locked at decision" marker after a final decision.
- **Comment** — a message in an idea's thread. Carries: idea id,
  author user id, author role at time of posting, optional parent
  comment id (for one-level replies), text content, timestamps for
  created and (optional) edited, soft-deleted flag and moderator
  attribution.
- **Anonymity Flag** — a boolean on the Idea (with optional override at
  submission time) plus a default flag on the Category. The idea's
  flag is the authoritative one once the idea exists.
- **Insight Snapshot (logical, not persisted)** — the aggregated values
  driving the charts: submissions per time bucket, decision counts and
  approval rate, per-category submission counts. Computed on demand
  from existing tables (Ideas + Status Transitions + Categories) plus
  the new rating data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After feature 004 ships, the share of submitted ideas
  whose author saved at least one draft beforehand is at least 30 %
  within 60 days — indicating drafts are genuinely used, not ignored.
- **SC-002**: The average length and information density of submitted
  ideas (measured by character count of description + filled structured
  answers) increases by at least 25 % vs. the 30 days prior to feature
  004 — i.e. drafts and discussion produce richer submissions.
- **SC-003**: 95 % of Reviewer decisions ship with a complete set of
  required per-dimension scores (no decisions blocked, no missing
  required dimensions) — i.e. the rating flow is workable, not
  frustrating.
- **SC-004**: Median time-to-first-reviewer-comment on a new submission
  drops below 24 working hours, and at least 50 % of ideas accumulate
  at least one back-and-forth (reviewer post + submitter reply) before
  decision — i.e. discussion actually happens.
- **SC-005**: For ideas flagged anonymous, zero Reviewer-facing API
  responses (queue, detail, thread, history, chart tooltips) contain
  the submitter's identifying fields, verified by automated tests
  across every endpoint.
- **SC-006**: Each of the three Insights charts renders its initial data
  in under 2 seconds on a 10 000-idea dataset; switching range
  re-renders all three within the same budget.
- **SC-007**: Admins can answer "what is our approval rate this
  quarter?" and "which category is dominating submissions?" in under
  10 seconds from a cold load of the Insights page.
- **SC-008**: The redesigned portal passes WCAG AA contrast and
  keyboard-navigation checks on all primary pages; an automated
  accessibility scan reports zero new violations introduced by
  feature 004.
- **SC-009**: Page load time for the redesigned home, listing, and
  detail pages remains at or below the feature 003 baseline (no
  regression worse than 10 %) despite the added charts, rating panel,
  and comment thread.

## Assumptions

- **DRAFT is not a lifecycle state on the Idea itself.** A draft is a
  separate entity ("Draft") owned by the author; submitting a draft
  creates a fresh `Idea` row in `SUBMITTED` state (or, if the
  implementation prefers, promotes the draft row into the idea row
  while transitioning `DRAFT → SUBMITTED`). Either implementation is
  acceptable; both must satisfy FR-003 (drafts invisible to other
  users) and FR-006 (validation runs on submit).
- **Submitters can request anonymity at submission time** in addition
  to the category default; Admins can override either way. This is a
  sensible default given the spirit of the feature; if the project
  prefers to restrict the toggle to Admins only, the per-idea override
  collapses to "Admin-only" and the spec still holds.
- **The default rating dimensions** (Feasibility, Impact, Originality,
  Alignment) are a reasonable starting set drawn from common innovation-
  portal practice. Admins can override per category.
- **Rating dimensions are versioned implicitly via "active" flag**: when
  a dimension is removed from a category, prior scores for it remain
  in the database, displayed as "(deprecated)" on the historical
  decision; no schema migration is required to rename or reorder a
  dimension.
- **Anonymity hides the submitter from reviewers, not from admins, not
  from the submitter themselves, and not from the audit log.** Full
  end-to-end anonymity (where even admins cannot trace the submitter)
  is explicitly out of scope.
- **Comments support plain text + line breaks only** in v1. Rich text,
  Markdown, mentions, file attachments on comments, and emoji reactions
  are out of scope for feature 004.
- **One level of reply nesting** is sufficient for v1 (parent comment +
  replies). Threaded discussions deeper than that are out of scope.
- **Insight charts are computed on demand** against the existing
  database (no separate analytics warehouse). At the target scale
  (≤ 10 000 ideas) this is acceptable.
- **Reviewer-restricted Insights** drops per-submitter detail but keeps
  per-category and per-status aggregates. Employees do not see
  Insights at all.
- **The frontend makeover is delivered as part of this feature, not as
  a separate "design refresh" release.** It is scoped to re-skin the
  existing pages plus the new feature 004 surfaces using a single
  design system, not to redesign navigation IA or business workflows.
- **No new authentication mechanism, no new role, no new database
  engine.** Feature 004 builds on the existing NextAuth-based auth,
  the existing `employee` / `reviewer` / `admin` role model, and the
  existing PostgreSQL + Drizzle ORM stack used by the project's Next.js
  App Router application.
- **CSV export from feature 003 is not required to change in v1 of
  feature 004.** Extending it to include rating and comment counts is
  a candidate follow-up, not a feature 004 deliverable.

## Clarifications

- **[NEEDS CLARIFICATION: Anonymous toggle owner]** — Should Submitters
  be allowed to request anonymity for their own idea at submission time
  (in addition to the category default and the Admin override), or is
  the per-idea anonymity toggle Admin-only? The spec currently assumes
  the more permissive default ("Submitters can request, Admins can
  override"), but a stricter "Admin-only" policy is equally defensible.
- **[NEEDS CLARIFICATION: Reviewer assignment model]** — The spec
  assumes the existing "any Reviewer can pick up any idea in queue"
  model from features 001–003 continues to apply, and that multiple
  Reviewers may each record their own per-dimension scores on the same
  idea (with the *deciding* reviewer's required-dimension check being
  the gate). If the project intends to move to explicit per-idea
  reviewer assignment as part of feature 004, the rating and comment
  visibility rules need a small extension.
- **[NEEDS CLARIFICATION: Chart library / rendering technology]** — The
  spec is technology-agnostic on charting per the speckit conventions.
  The implementation plan should pick a single charting approach
  (lightweight SVG components vs. a library such as Recharts /
  Visx / Chart.js) consistent with the existing Next.js + Tailwind +
  shadcn/ui stack so that the makeover (Story 5) and the charts
  (Story 4) share a visual language.
