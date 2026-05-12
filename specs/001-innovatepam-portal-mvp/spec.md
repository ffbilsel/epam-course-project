# Feature Specification: InnovatEPAM Portal — Phase 1 MVP

**Feature Branch**: `001-innovatepam-portal-mvp`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "InnovatEPAM Portal — an internal employee
innovation management platform. Employees submit creative ideas with
supporting attachments; evaluators and admins review, score, and decide on
them; the organization tracks each idea from submission to final decision.
Phase 1 covers authentication with three roles (Employee, Evaluator, Admin),
idea submission with file attachments, listing of own ideas, an admin review
queue, and evaluation (score + comment + status transition: SUBMITTED →
UNDER_REVIEW → APPROVED/REJECTED → IMPLEMENTED). Out of scope for Phase 1:
email notifications, analytics dashboards, public idea sharing, multi-tenant
org separation. Phase 1 MVP scope: User Management (register, login,
logout; submitter vs admin roles), Idea Submission (form with title,
description, category; single file attachment; idea listing view), and
Evaluation Workflow (status tracking submitted → under review →
accepted/rejected; admin accept/reject with comments)."

## Clarifications

### Session 2026-05-12

The following decisions resolve every `[NEEDS CLARIFICATION]` marker
from the initial draft and are now binding requirements (see FR-002,
FR-004, FR-005, FR-005a, FR-005b, FR-008, FR-008a–d, FR-010, FR-018a,
FR-019a, FR-024).

- **Roles**: three distinct roles — Employee, Evaluator, Admin.
  Employee submits; Evaluator reviews + decides; Admin does everything
  Evaluator does plus user management, category approval, and the
  IMPLEMENTED transition.
- **Role provisioning**: Admins promote/demote other users via a
  user-management UI. The very first Admin is bootstrapped from
  `BOOTSTRAP_ADMIN_EMAIL` at startup; the mechanism is a no-op once
  any Admin exists.
- **Password policy**: minimum 8 characters, at least one letter and
  one digit; no maximum length.
- **Session lifetime**: 24 hours, sliding (resets on each request).
- **Categories**: seeded list — Process Improvement, Product
  Innovation, Tooling, Customer Experience, Other. Employees may
  propose new categories at submission time; Admins approve
  (→ ACTIVE) or reject (→ REJECTED, ideas re-linked to Other).
  Reviewers cannot decide on an idea while its category is PROPOSED.
- **Attachments**: PDF, PNG, JPEG, DOCX, PPTX; max 25 MB; MIME type
  verified server-side via magic-number sniff.
- **UNDER_REVIEW transition**: explicit "Start review" action by an
  Evaluator/Admin on the detail page; never set implicitly on page
  load.
- **APPROVED → IMPLEMENTED**: Admin-only action ("Mark as
  implemented") on the detail page once the idea is APPROVED.
  Evaluators do not see this action.
- **Locale**: dates and times use the browser's auto-detected locale
  (`navigator.language`); no in-app locale switcher.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Employee submits an innovation idea (Priority: P1)

An employee signs in to the portal, opens the "Submit Idea" form, fills in
title, description and category, optionally attaches a single supporting
file, and submits. The system stores the idea with status `SUBMITTED` and
shows it on the employee's "My Ideas" list.

**Why this priority**: Without idea capture there is no product. This single
journey alone is a usable MVP — an organization can already collect
innovation in one place even if reviewers process them out-of-band.

**Independent Test**: A signed-in employee can complete the full flow
(open form → submit valid idea → see it on "My Ideas" with status
`SUBMITTED`) without any admin or reviewer functionality being implemented.

**Acceptance Scenarios**:

1. **Given** an authenticated Employee on the "Submit Idea" page, **When**
   they submit a form with a valid title, description, an existing
   `ACTIVE` category, and one attachment within the size/type limits,
   **Then** the system persists the idea with status `SUBMITTED`, stores
   the attachment, and redirects to "My Ideas" where the new idea
   appears at the top.
2. **Given** an authenticated Employee on the "Submit Idea" page, **When**
   they submit the form with the title field empty, **Then** the system
   rejects the submission, shows an inline validation error on the title
   field, and does not create an idea record.
3. **Given** an authenticated Employee on the "Submit Idea" page, **When**
   they submit a form without an attachment, **Then** the system accepts
   the submission and creates the idea with no attachment record.
4. **Given** an authenticated Employee on the "Submit Idea" page, **When**
   they choose "Propose new category", enter a unique new category
   name, and submit a valid form, **Then** the system creates a
   Category record in state `PROPOSED` linked to that Employee, creates
   the Idea linked to it with status `SUBMITTED`, and shows the idea on
   "My Ideas" with an indicator that the category is awaiting approval.
5. **Given** an unauthenticated visitor, **When** they navigate to the
   "Submit Idea" page, **Then** the system redirects them to login.

---

### User Story 2 — Evaluator/Admin reviews and decides on an idea (Priority: P1)

An Evaluator or Admin signs in, opens the review queue showing all ideas
not yet decided, picks an idea, optionally clicks "Start review" to mark
it `UNDER_REVIEW`, reads its details and downloads the attachment,
records a decision (accept or reject) with a comment, and the idea's
status updates accordingly. The submitting employee sees the new status
on their "My Ideas" list.

**Why this priority**: The MVP is only complete when ideas can be acted on.
Capturing ideas without ever resolving them defeats the platform's purpose.

**Independent Test**: With at least one `SUBMITTED` idea in the database,
an authenticated Evaluator can open the queue, open the idea, click
"Start review", submit a decision + comment, and observe the status
change reflected for the submitting employee.

**Acceptance Scenarios**:

1. **Given** an authenticated Evaluator and at least one idea with
   status `SUBMITTED`, **When** the Evaluator opens the review queue,
   **Then** the idea is listed with title, author, category, and
   submission date.
2. **Given** an Evaluator viewing a `SUBMITTED` idea's detail page,
   **When** they click "Start review", **Then** the idea status
   changes to `UNDER_REVIEW`, the transition is recorded with the
   reviewer identity and timestamp, and the idea remains in the queue.
3. **Given** an Evaluator viewing an idea detail page in state
   `SUBMITTED` or `UNDER_REVIEW`, **When** they submit "Accept" with a
   non-empty comment, **Then** the idea's status changes to
   `APPROVED`, the transition is persisted with the reviewer identity,
   and the idea is removed from the pending queue.
4. **Given** an Evaluator viewing an idea detail page, **When** they
   submit "Reject" with a non-empty comment, **Then** the idea's
   status changes to `REJECTED`, the transition is persisted, and the
   idea is removed from the pending queue.
5. **Given** an Evaluator attempts to submit a decision with an empty
   or whitespace-only comment, **When** they click submit, **Then** the
   system rejects the action and shows a validation error requiring a
   comment.
6. **Given** an Evaluator viewing an idea whose category is in state
   `PROPOSED`, **When** they attempt to click "Start review" or submit
   any decision, **Then** the action is disabled (or rejected
   server-side) with a message "Awaiting category approval".
7. **Given** an Admin viewing an `APPROVED` idea's detail page, **When**
   they click "Mark as implemented", **Then** the idea's status
   changes to `IMPLEMENTED` and the transition is recorded.
8. **Given** an Evaluator viewing an `APPROVED` idea's detail page,
   **When** the page is rendered, **Then** the "Mark as implemented"
   action MUST NOT be visible.
9. **Given** an authenticated Employee whose idea has just been decided,
   **When** they open "My Ideas", **Then** the new status and the
   reviewer's comment are visible on that idea.

---

### User Story 3 — User registers, logs in and logs out (Priority: P1)

A new user creates an account with email and password, logs in, and can
later log out. Registered users have a role (Employee, Evaluator, or
Admin) that governs which areas of the portal they can access.

**Why this priority**: Authentication is a hard prerequisite for both
P1 stories above. It is listed third only because, on its own, it
delivers no end-user value — it is enabling functionality for stories 1
and 2.

**Independent Test**: A user can register, log in, see a role-appropriate
landing page, and log out — verifiable without any idea or evaluation
functionality wired up.

**Acceptance Scenarios**:

1. **Given** a visitor on the registration page, **When** they submit a
   valid email and a password meeting the policy (≥ 8 chars, at least
   one letter and one digit), **Then** an account is created with the
   default Employee role and they are redirected to login.
2. **Given** a registered user on the login page, **When** they submit
   correct credentials, **Then** they are signed in and routed to the
   role-appropriate landing page (Employee → "My Ideas";
   Evaluator/Admin → review queue).
3. **Given** a registered user with wrong credentials, **When** they
   attempt login, **Then** the system rejects authentication and shows a
   generic "invalid credentials" message (no enumeration of which field
   is wrong).
4. **Given** an authenticated user, **When** they trigger logout, **Then**
   their session is invalidated and they are redirected to login;
   subsequent attempts to access protected pages redirect to login.
5. **Given** an authenticated user, **When** they make an authenticated
   request, **Then** the session expiry MUST be reset to 24 hours from
   that moment (sliding).
6. **Given** an authenticated Employee, **When** they navigate directly
   to an Evaluator/Admin-only URL (e.g. the review queue), **Then** the
   system denies access (redirect or 403).

---

### User Story 4 — Admin manages users and categories (Priority: P2)

An Admin opens a user-management page, changes another user's role
(Employee ↔ Evaluator ↔ Admin); separately, an Admin opens the
category-moderation page and approves or rejects categories proposed
by Employees during idea submission.

**Why this priority**: Required to operate the system over time but not
strictly needed for a one-shot MVP demo — the bootstrap Admin and the
seeded category list cover day-zero usage.

**Independent Test**: With at least one bootstrap Admin and one
`PROPOSED` category in the database, an Admin can change another
user's role and approve/reject the proposed category through
dedicated pages.

**Acceptance Scenarios**:

1. **Given** an Admin on the user-management page, **When** they
   change another user's role from Employee to Evaluator, **Then** the
   change is persisted and the affected user's next request is
   evaluated under the new role.
2. **Given** an Admin who is the only remaining Admin, **When** they
   attempt to demote themselves, **Then** the system rejects the
   action with an error "Cannot demote the last remaining Admin".
3. **Given** an Admin on the category-moderation page with one
   `PROPOSED` category, **When** they approve it, **Then** the
   category becomes `ACTIVE`, appears in the submission dropdown for
   future ideas, and any ideas already linked to it become reviewable.
4. **Given** an Admin on the category-moderation page, **When** they
   reject a `PROPOSED` category, **Then** the category becomes
   `REJECTED`, every idea currently linked to it is re-linked to
   `Other`, and the affected authors see the change in "My Ideas".

---

### Edge Cases

- **Attachment too large or wrong type**: submission MUST be rejected with
  a clear inline error stating the limit (25 MB; PDF/PNG/JPEG/DOCX/PPTX);
  no partial upload is persisted.
- **Attachment MIME spoofing**: a file whose declared `Content-Type` is
  in the allow-list but whose magic-number bytes are not MUST be
  rejected with `ATTACHMENT_TYPE_NOT_ALLOWED`.
- **Attachment upload succeeds but idea creation fails**: the orphan file
  MUST be cleaned up (no dangling files in storage).
- **Two reviewers decide the same idea concurrently**: the second decision
  MUST be rejected with `IDEA_ALREADY_DECIDED`; the first decision wins.
- **Two reviewers click "Start review" simultaneously**: only the first
  transition is recorded; the second is a no-op (idea is already
  `UNDER_REVIEW`).
- **Employee tries to view another employee's idea via direct URL**:
  access MUST be denied; only the author and Evaluators/Admins may view
  an idea's detail page.
- **Employee tries to evaluate or change status on their own idea**: MUST
  be denied at the authorization layer.
- **Decision comment is whitespace only**: treated as empty; rejected.
- **Reviewer logs out mid-evaluation**: in-flight decision form is lost;
  no partial decision is persisted.
- **Idea title or description at exactly the boundary length**: accepted
  at the limit, rejected one character over.
- **Proposed category name collides** (case-insensitively) with an
  existing `ACTIVE` or `PROPOSED` category: submission MUST be rejected
  with `IDEA_CATEGORY_INVALID`; the Employee is told to pick the
  existing one.
- **Re-submitting the same form twice (double-click)**: only one idea
  record is created.
- **Last Admin attempts to demote self**: rejected with a dedicated
  error code (e.g., `USER_LAST_ADMIN_DEMOTION`).
- **Bootstrap admin email matches an existing non-Admin**: at startup,
  that user is promoted to Admin; subsequent startups are no-ops.
- **Session expires mid-form**: the next state-changing request is
  rejected with `AUTH_SESSION_EXPIRED`; the form's data is preserved
  client-side and the user is redirected to login with a return-to
  URL.

## Requirements *(mandatory)*

### Functional Requirements

#### Authentication & User Management

- **FR-001**: The system MUST allow visitors to register an account using
  email and password.
- **FR-002**: The system MUST validate that the email is unique and the
  password meets the documented password policy: minimum 8 characters,
  at least one letter and at least one digit. No maximum length is
  imposed beyond what hashing supports.
- **FR-003**: The system MUST allow registered users to log in and log out.
- **FR-004**: The system MUST issue a session that persists across page
  navigations. Session lifetime is **24 hours sliding** — each
  authenticated request resets the expiry to 24 hours from now; an
  idle session expires 24 hours after the last request. Logout
  invalidates the session immediately.
- **FR-005**: The system MUST assign every user exactly one role from
  {Employee, Evaluator, Admin}.
  - **Employee**: can submit ideas, view and manage their own ideas.
  - **Evaluator**: everything an Employee can do, plus view the review
    queue and record decisions on others' ideas. Cannot manage users
    or categories.
  - **Admin**: everything an Evaluator can do, plus promote/demote
    other users between roles and approve/reject proposed categories.
  New self-registered users default to **Employee**.
- **FR-005a**: An Admin MUST be able to change another user's role
  (Employee ↔ Evaluator ↔ Admin) via a user-management UI. An Admin
  MUST NOT be able to demote themselves if they are the last
  remaining Admin (the system MUST prevent leaving zero Admins).
- **FR-005b**: At application startup, the system MUST seed exactly
  one bootstrap Admin from the `BOOTSTRAP_ADMIN_EMAIL` environment
  variable if no Admin exists. If that email matches an existing
  Employee/Evaluator, the user is promoted to Admin; if no such user
  exists, the email is recorded as a pending bootstrap and the next
  registration with that email becomes Admin on creation. After at
  least one Admin exists, the bootstrap mechanism is a no-op.
- **FR-006**: The system MUST enforce role-based authorization on every
  page and API route; unauthorized access MUST be denied with a redirect
  (for pages) or a 403 response (for APIs).

#### Idea Submission

- **FR-007**: Authenticated Employees MUST be able to submit a new idea
  with the fields: title, description, category.
- **FR-008**: The system MUST validate idea fields:
  - title: required, length 1–120 characters.
  - description: required, length 1–2000 characters.
  - category: required; either a reference to an existing `ACTIVE`
    Category, OR a proposed new category name (1–40 characters,
    unique case-insensitively against existing categories) when the
    Employee chooses "Propose new category" in the form.
- **FR-008a**: The system MUST seed the following Categories as
  `ACTIVE` on first startup: **Process Improvement**, **Product
  Innovation**, **Tooling**, **Customer Experience**, **Other**. The
  `Other` category MUST NOT be deletable and serves as the fallback
  for rejected category proposals (see FR-008c).
- **FR-008b**: When an Employee submits an idea with a proposed new
  category, the system MUST create a Category record in state
  `PROPOSED` (linked to the proposing Employee) and link the idea to
  it. The idea is created normally with status `SUBMITTED`; reviewers
  MUST NOT be able to record a decision on the idea while its
  category is `PROPOSED` (see FR-022a).
- **FR-008c**: An Admin MUST be able to **approve** a `PROPOSED`
  category (state → `ACTIVE`; thereafter selectable in the dropdown
  for any future submission) or **reject** it. On rejection, every
  idea currently linked to that category MUST be re-linked to the
  `Other` category, and the rejected Category record MUST be marked
  `REJECTED` (kept for audit; not selectable).
- **FR-008d**: The category dropdown shown to Employees during
  submission MUST list only `ACTIVE` categories. The Employee MUST
  also see a "Propose new category" option that reveals an inline
  text field for the proposed name.
- **FR-009**: The system MUST allow attaching at most one file to an idea
  at submission time.
- **FR-010**: The system MUST validate the attachment:
  - allowed MIME types: PDF (`application/pdf`), PNG (`image/png`),
    JPEG (`image/jpeg`), DOCX
    (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`),
    PPTX
    (`application/vnd.openxmlformats-officedocument.presentationml.presentation`).
    The MIME type MUST be verified server-side from the file's actual
    bytes (magic-number sniff), not just the client-declared
    `Content-Type`.
  - maximum size: **25 MB**.
- **FR-011**: The system MUST persist the attachment durably and link it
  to its idea; downloading the attachment MUST be available to the idea's
  author and to any Evaluator/Admin.
- **FR-012**: A new idea MUST be created with status `SUBMITTED` and an
  immutable author reference.
- **FR-013**: The system MUST record submission timestamp on every idea
  and decision timestamp on every decided idea.

#### Idea Listing

- **FR-014**: Authenticated Employees MUST be able to view a "My Ideas"
  list showing every idea they authored, with title, category, submission
  date, current status, and (if decided) reviewer comment.
- **FR-015**: The "My Ideas" list MUST be sorted with most recently
  updated first.
- **FR-016**: Employees MUST NOT see other employees' ideas in any list
  view in Phase 1.

#### Evaluation Workflow

- **FR-017**: Evaluators and Admins MUST be able to view a review queue
  containing every idea whose status is `SUBMITTED` or `UNDER_REVIEW`,
  with title, author, category, and submission date.
- **FR-018**: Evaluators and Admins MUST be able to open the detail view
  of any idea, including author, full description, category, attachment
  download link, and history of status changes and comments.
- **FR-018a**: An Evaluator or Admin viewing a `SUBMITTED` idea's detail
  page MUST see an explicit **"Start review"** action. Activating it
  transitions the idea from `SUBMITTED` to `UNDER_REVIEW` and records
  the reviewer identity and timestamp. Status MUST NOT change implicitly
  on page load.
- **FR-019**: Evaluators and Admins MUST be able to record a decision of
  `APPROVED` or `REJECTED` on an idea (in state `SUBMITTED` or
  `UNDER_REVIEW`), accompanied by a non-empty comment.
- **FR-019a**: Once an idea is `APPROVED`, the idea detail page MUST
  show an **"Mark as implemented"** action visible only to Admins.
  Activating it transitions the idea from `APPROVED` to `IMPLEMENTED`
  and records the Admin identity, timestamp, and an optional comment.
  Evaluators MUST NOT see or be able to invoke this action.
- **FR-020**: The system MUST persist every decision and status
  transition with: actor identity, timestamp, transition
  (from-state → to-state), and comment (required for
  `APPROVED`/`REJECTED`; optional for `UNDER_REVIEW` and `IMPLEMENTED`
  transitions).
- **FR-021**: Allowed status transitions MUST be exactly:
  `SUBMITTED → UNDER_REVIEW`, `SUBMITTED → APPROVED`,
  `SUBMITTED → REJECTED`, `UNDER_REVIEW → APPROVED`,
  `UNDER_REVIEW → REJECTED`, `APPROVED → IMPLEMENTED`. Any other
  transition MUST be rejected.
- **FR-022**: The system MUST prevent a user from deciding on or
  transitioning the status of their own idea, regardless of role.
- **FR-022a**: The system MUST prevent any decision (APPROVED /
  REJECTED) and any UNDER_REVIEW transition on an idea whose category
  is in state `PROPOSED`. The reviewer UI MUST surface this with a
  clear message ("Awaiting category approval").
- **FR-023**: Once an idea is `APPROVED`, `REJECTED`, or `IMPLEMENTED`,
  it MUST NOT appear in the pending review queue.
- **FR-024**: The Evaluator role is distinct from Admin in Phase 1.
  Evaluators perform reviews and decisions; Admins additionally manage
  users (FR-005a) and categories (FR-008c) and own the
  `APPROVED → IMPLEMENTED` transition (FR-019a).

#### Cross-cutting

- **FR-025**: All form input MUST be validated server-side; client-side
  validation is presentational only.
- **FR-026**: The system MUST NOT enumerate accounts on login failure
  (generic error message regardless of which field is wrong).
- **FR-027**: All destructive or state-changing operations (submit idea,
  decide, logout) MUST be CSRF-protected.
- **FR-028**: The system MUST log security-relevant events
  (registration, login success/failure, logout, decision recorded) to the
  application log with timestamp and user id.

### Key Entities *(include if feature involves data)*

- **User**: a person who can authenticate. Attributes: id, email,
  password hash, display name, role (Employee | Evaluator | Admin),
  created-at. One User authors many Ideas; one User records many
  Decisions; one User may propose many Categories.
- **Category**: a classification an Idea belongs to. Attributes: id,
  name (unique, case-insensitive), state (ACTIVE | PROPOSED |
  REJECTED), proposed-by (User, nullable for seeded categories),
  created-at, decided-at (nullable), decided-by (User, nullable).
  Seeded categories: Process Improvement, Product Innovation, Tooling,
  Customer Experience, Other (Other is non-deletable, fallback for
  rejected proposals).
- **Idea**: a creative submission by an Employee. Attributes: id, author
  (User), title, description, category (Category), status (SUBMITTED |
  UNDER_REVIEW | APPROVED | REJECTED | IMPLEMENTED), created-at,
  updated-at. Has zero or one Attachment, has zero or many
  StatusTransitions (history).
- **Attachment**: a single supporting file linked to an Idea. Attributes:
  id, idea (Idea), original file name, stored path, MIME type, size,
  uploaded-at.
- **StatusTransition** *(supersedes Decision; serves as evaluation and
  history record)*: a recorded transition on an Idea. Attributes: id,
  idea (Idea), actor (User), from-state, to-state, comment (required
  for APPROVED/REJECTED transitions, optional otherwise), recorded-at.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A registered Employee can complete the end-to-end "submit
  idea with attachment" flow in under 2 minutes on first attempt without
  consulting documentation.
- **SC-002**: An Admin can decide on a `SUBMITTED` idea (open queue →
  open detail → submit decision with comment) in under 90 seconds.
- **SC-003**: 100% of state-changing operations reject invalid input
  server-side, regardless of client-side validation state, as verified by
  the integration test suite.
- **SC-004**: 100% of role-protected pages and APIs deny access to users
  without the required role, as verified by integration tests.
- **SC-005**: Status transitions outside the allowed set in FR-021 are
  rejected in 100% of attempts, as verified by unit tests of the domain
  service.
- **SC-006**: An Employee viewing "My Ideas" sees a decision recorded by
  an Admin within one page refresh of the decision being saved (no
  caching artefact requiring re-login).
- **SC-007**: Zero orphaned attachment files remain in storage after
  failed idea submissions, as verified by an integration test that
  forces the post-upload step to fail.

## Assumptions

- Phase 1 targets a single tenant / single organization; multi-tenant
  isolation is explicitly out of scope.
- Authentication is local email + password; no SSO, OAuth, or external
  identity provider is in scope for Phase 1.
- File storage is local filesystem under the application's control; no
  cloud object storage in Phase 1.
- The portal is accessed over a trusted internal network or HTTPS in
  production; transport security is assumed and not re-specified here.
- One user has one role at a time; multi-role users are out of scope.
- Email notifications, analytics dashboards, public idea sharing, and
  search/filter UX beyond simple sorting are out of scope (per the
  Phase 1 brief).
- The Evaluator role is distinct from Admin (FR-024). Both can review
  and decide; only Admin manages users (FR-005a), approves categories
  (FR-008c), and marks ideas as IMPLEMENTED (FR-019a).
- The `IMPLEMENTED` status is reachable only from `APPROVED` and is
  recorded by an Admin via an explicit "Mark as implemented" action
  on the idea detail page.
- Date and time are formatted using the **browser's locale**
  (auto-detected via `navigator.language`); no in-app locale switcher
  in Phase 1.
- Browsers in scope are current evergreen Chromium, Firefox, and
  Safari; no legacy IE/Edge-Legacy support.
- Users are EPAM employees and are trusted not to submit malicious
  files; antivirus scanning of attachments is out of scope for Phase 1
  (MIME and size validation only, with magic-number sniffing per
  FR-010).
- The bootstrap Admin email (FR-005b) is provided via
  `BOOTSTRAP_ADMIN_EMAIL` and is read once on each startup; it is a
  no-op once at least one Admin exists in the database.
