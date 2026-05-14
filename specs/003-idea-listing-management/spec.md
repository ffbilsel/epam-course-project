# Feature Specification: Idea Listing & Management Enhancements

**Feature Branch**: `003-idea-listing-management`  
**Created**: 14 May 2026  
**Status**: Draft  
**Input**: User description: "Edit/Delete Ideas — allow submitters to edit or delete their ideas (consider: what if evaluation already started?); a history tab; paginate the idea listing for better performance with many ideas; export to CSV — allow admins to export idea data for reporting; search & filter — add search bar and filters (by category, status, date range) to idea listing"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Edit or delete my own idea (Priority: P1)

As an Employee who submitted an idea, I want to fix typos or unclear wording before a reviewer has started looking at it, and I want to be able to retract (delete) an idea I no longer want to put forward. After a reviewer has begun evaluation, edits and deletions must be blocked so that reviewers always see what they decided on.

**Why this priority**: This closes the most common day-one frustration — "I made a typo in my submission and can't fix it" — and is a prerequisite for trusting the platform with non-trivial ideas. Without it, users either spam duplicates or stop submitting.

**Independent Test**: An Employee creates an idea, opens its detail page, edits the title/description/category/answers, saves, and sees the new content reflected on the detail page and the My Ideas list. A reviewer then starts review of a different idea by the same author; on returning to that one, the Employee no longer sees Edit/Delete controls and any direct edit/delete attempt is rejected with a clear message.

**Acceptance Scenarios**:

1. **Given** an idea in `SUBMITTED` status that I authored, **When** I open its detail page, **Then** I see Edit and Delete actions.
2. **Given** I am editing my `SUBMITTED` idea, **When** I save valid changes to title/description/category/structured answers, **Then** the idea updates and a history entry records that the author edited it.
3. **Given** my idea has moved to `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `IMPLEMENTED`, **When** I open the detail page, **Then** Edit and Delete are not offered and any direct API attempt fails with a clear "evaluation already started" error.
4. **Given** I am not the author, **When** I open someone else's idea, **Then** I never see Edit or Delete controls regardless of their status.
5. **Given** I delete my `SUBMITTED` idea, **When** I return to My Ideas, **Then** the idea no longer appears, its attachment (if any) is no longer accessible, and no reviewer queue entry remains for it.

---

### User Story 2 — Search & filter the idea listing (Priority: P1)

As a Reviewer or Admin working through a large queue (or an Employee scrolling My Ideas), I want to narrow the list by free-text search, category, status, and a date range so I can find what matters in seconds instead of scrolling.

**Why this priority**: Once there are more than a few dozen ideas, an unfiltered list becomes unusable. Search & filter is what makes pagination (Story 3) worth having and is the day-to-day workhorse for reviewers.

**Independent Test**: A user with at least 30 mixed-status ideas in their scope (My Ideas or queue) loads the listing, types a phrase from one idea's title in the search box, picks a category and a status from dropdowns, sets a from/to date, and sees only ideas matching every active filter; clearing each filter returns the corresponding rows.

**Acceptance Scenarios**:

1. **Given** the listing page, **When** I type a phrase into the search box, **Then** only ideas whose title or description contains that phrase (case-insensitive) are shown.
2. **Given** the listing page, **When** I pick a category from the category filter, **Then** only ideas in that category are shown.
3. **Given** the listing page, **When** I pick a status from the status filter, **Then** only ideas with that status are shown.
4. **Given** the listing page, **When** I set a "submitted from" and/or "submitted to" date, **Then** only ideas whose submission timestamp falls in that range are shown.
5. **Given** I combine multiple filters, **When** I apply them together, **Then** ideas are returned that satisfy ALL active filters (AND semantics).
6. **Given** I have active filters, **When** I reload the page or share the URL, **Then** the same filter set is reapplied (filters are reflected in the URL).
7. **Given** no ideas match the active filters, **When** the list renders, **Then** I see an empty state with a "clear filters" affordance.

---

### User Story 3 — Paginate the idea listing (Priority: P2)

As any role using the listing pages, I want the listing to load a manageable number of rows at a time with controls to move between pages, so the page stays responsive even when the database has thousands of ideas.

**Why this priority**: Required for performance at scale; lower priority than Story 2 because filters already shrink the result set for most real workflows. Pagination plugs the worst-case path.

**Independent Test**: Seed the database with a number of ideas larger than the chosen page size. Open the listing — only the first page renders. Navigate forward/backward; the URL reflects the page, the total count is visible, and the same filters from Story 2 stay in effect across page changes.

**Acceptance Scenarios**:

1. **Given** the listing has more results than one page, **When** the page loads, **Then** I see at most one page-worth of rows plus a pagination control.
2. **Given** I am on page 1, **When** I click "next" / a page number, **Then** the listing shows the next slice of rows and the URL reflects the new page.
3. **Given** I have active filters or a search query, **When** I change pages, **Then** the filters/query persist and pagination respects the filtered total.
4. **Given** I change a filter, **When** the result set shrinks, **Then** I am returned to page 1 (so I don't end up viewing a page beyond the new total).
5. **Given** I am on the listing, **When** the page renders, **Then** I see the total number of matching ideas alongside the current page indicator.

---

### User Story 4 — Per-idea history tab (Priority: P2)

As an Employee, Reviewer, or Admin viewing an idea detail page, I want a dedicated "History" tab that shows the full chronological audit trail for that idea — submission, edits by the author, reviewer transitions with their comments, and (for Admin) implementation marking — so I can understand how the idea got to where it is.

**Why this priority**: The audit trail already exists in storage; surfacing it removes the need to ask "who changed what and when?" and supports trust and accountability in reviews. Lower priority than P1 because it is read-only and does not block the core workflow.

**Independent Test**: An idea that has been submitted, edited by the author, started by a reviewer, and approved with a comment shows four entries on the History tab in chronological order, each with timestamp, actor display name, action, and (for transitions) the comment.

**Acceptance Scenarios**:

1. **Given** I am on an idea detail page I am allowed to view, **When** I open the History tab, **Then** I see every recorded event in chronological order (oldest first or newest first; consistent within the tab).
2. **Given** an event was a status transition, **When** I view its row, **Then** I see the from-state, to-state, actor, timestamp, and (if provided) the comment.
3. **Given** an event was an author edit, **When** I view its row, **Then** I see "edited" with timestamp and actor; field-level diffs are out of scope for v1.
4. **Given** an event was a deletion, **When** the idea is already gone, **Then** the History tab is unreachable (the idea no longer exists).

---

### User Story 5 — Admin CSV export (Priority: P3)

As an Admin running reports for leadership, I want to export the current filtered idea list to a CSV file so I can pivot the data in a spreadsheet and share it.

**Why this priority**: Operational nice-to-have rather than core flow. It hinges on Story 2 (filters) being in place to be useful.

**Independent Test**: An Admin opens the idea listing, applies one or more filters, clicks Export, and receives a CSV file whose rows match the filtered set and whose columns cover id, title, category, status, author email, submitted-at, and decided-at.

**Acceptance Scenarios**:

1. **Given** I am an Admin on the listing page, **When** I click Export CSV, **Then** the browser downloads a CSV file representing the same rows the listing would show across all pages of the current filter (i.e. all matches, not just the visible page).
2. **Given** I am not an Admin, **When** I attempt to call the export endpoint, **Then** the request is rejected with a forbidden response.
3. **Given** the export contains user data, **When** I open it, **Then** it includes only fields the admin already sees in the UI (no password hashes, no internal IDs that aren't already visible) — RFC 4180–compliant escaping for commas, quotes, and newlines.

---

### Edge Cases

- An employee tries to edit a `SUBMITTED` idea while concurrently a reviewer hits "Start review". The reviewer's transition and the edit race: the system must reject whichever request lands second with a clear conflict error and leave the idea in a consistent state.
- An employee deletes a `SUBMITTED` idea while the idea is open in another tab as the reviewer's queue: the queue must no longer surface that idea on its next refresh and the detail page returns a not-found.
- Date-range filter receives an inverted range (from > to): the listing returns an empty result and the UI flags the inverted range, rather than throwing.
- Search query is very long (e.g. > 200 chars) or contains SQL-meta characters: query is truncated/escaped, never executed unsafely.
- Page parameter in URL is out of range (e.g. `?page=999` when there are 3 pages): listing clamps to the last available page rather than returning an error.
- Export is requested against a huge filter (e.g. "all ideas, no filters") in a deployment with very many rows: the response streams or paginates internally so the request does not time out; UI gives feedback while the file is prepared.
- A history event references a user who has since been deactivated/deleted: the row still renders with a last-known display name rather than a blank actor.

## Requirements *(mandatory)*

### Functional Requirements

#### Edit & delete (Story 1)

- **FR-001**: The system MUST allow only the author of an idea to edit or delete it, and only while the idea is in the `SUBMITTED` status.
- **FR-002**: The system MUST reject any edit or delete attempt for an idea whose status is `UNDER_REVIEW`, `APPROVED`, `REJECTED`, or `IMPLEMENTED` with a stable, dedicated error code (e.g. `IDEA_NOT_EDITABLE` / `IDEA_NOT_DELETABLE`).
- **FR-003**: An accepted edit MUST allow changing title, description, category, structured answers, and the attached file (replace or remove), subject to the same validation rules that apply at submission time.
- **FR-004**: An accepted edit MUST record a "edited" entry in the idea's history with timestamp and actor; the idea's `updated_at` MUST advance.
- **FR-005**: An accepted delete MUST remove the idea, its structured answers, and any associated attachment from the user-facing surfaces and from storage; the underlying audit log of prior transitions for that idea MAY be retained for compliance but MUST NOT be reachable through the normal UI (the idea is "gone").
- **FR-006**: The UI MUST hide Edit and Delete controls whenever they would be rejected server-side (defence-in-depth) so users don't see buttons that always fail.

#### Search & filter (Story 2)

- **FR-007**: The Employee My-Ideas listing and the Reviewer/Admin queue/listing MUST accept a free-text search applied case-insensitively across the idea title and description.
- **FR-008**: The listing MUST accept a category filter (single category) and a status filter (one or more of the lifecycle statuses).
- **FR-009**: The listing MUST accept a "submitted on or after" date and a "submitted on or before" date, applied to the idea's submission timestamp.
- **FR-010**: When multiple filters are present, the listing MUST return only ideas that match ALL filters (AND semantics).
- **FR-011**: Active filters MUST be reflected in the page URL so reloads, bookmarks, and shared links reproduce the same view.
- **FR-012**: Changing any filter MUST reset the listing to page 1 (interaction with Story 3).
- **FR-013**: The Employee listing MUST never expose ideas authored by other employees, regardless of filter values.

#### Pagination (Story 3)

- **FR-014**: The listing MUST return at most one page of rows per request; the default page size is 20 rows and the user can switch to 50 or 100.
- **FR-015**: The listing MUST expose the total number of matching rows (post-filter) and the current page number in the response/UI.
- **FR-016**: The page indicator MUST be part of the URL so navigation preserves position on reload.
- **FR-017**: If the requested page exceeds the total pages, the system MUST clamp to the last available page rather than returning an error.
- **FR-018**: Pagination MUST honour the currently active filters and search query.

#### History tab (Story 4)

- **FR-019**: The idea detail page MUST expose a "History" tab listing every recorded event for the idea in chronological order.
- **FR-020**: For each event, the tab MUST show the timestamp, the actor's display name at time of the event, and the event kind (`SUBMITTED`, `EDITED`, `STARTED_REVIEW`, `APPROVED`, `REJECTED`, `IMPLEMENTED`).
- **FR-021**: For transition events, the tab MUST show the recorded comment (if any).
- **FR-022**: The History tab MUST be visible to anyone who is already allowed to view the idea detail page (author, reviewers, admins); it MUST NOT leak any data the caller could not otherwise see.

#### Admin CSV export (Story 5)

- **FR-023**: The system MUST expose an Admin-only export action on the idea listing that returns a CSV of every idea matching the currently active filters (ignoring the page-size limit).
- **FR-024**: The CSV MUST include at least: idea id, title, category name, status, author display name, author email, submitted-at, last-decided-at (if any), decided-by display name (if any). Implementation details (raw UUID styles, internal column names) MUST NOT leak unless the field is already user-visible.
- **FR-025**: The CSV MUST escape commas, quotes, and newlines per RFC 4180 so spreadsheet apps parse it correctly.
- **FR-026**: Calls to the export endpoint by non-admins MUST be rejected with the existing forbidden-role error code.
- **FR-027**: The export action MUST be recorded as a security event in the audit log (actor, filter parameters, row count) so admin data extraction is traceable.

### Key Entities *(include if feature involves data)*

- **Idea** — the existing entity; gains an "editable" lifecycle property derived from `status` and a soft notion of deletion (removed from user-facing surfaces).
- **Idea History Event** — a chronological row tied to an idea, covering submission, author edits, status transitions, and (where relevant) deletion. Extends the existing `status_transitions` audit table with two new event kinds: `SUBMITTED` (synthesised from the idea's `created_at`) and `EDITED` (recorded on each successful edit).
- **Listing Query** — the structured query that drives every listing page: caller scope (mine vs. queue vs. all), search string, category filter, status filter, date range, page, page size. Same shape feeds the UI listing and the CSV export.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Employee can correct a typo in a `SUBMITTED` idea in under 30 seconds end-to-end (open detail → edit → save → see updated value).
- **SC-002**: After Story 1 ships, the rate of duplicate-idea submissions caused by "I couldn't edit mine" drops to effectively zero in a 30-day window (measured by author-flagged duplicates).
- **SC-003**: A reviewer can locate any specific idea by title fragment + status in under 5 seconds from the listing page, with up to 10 000 ideas in the database, on a single modest server.
- **SC-004**: 95% of idea-listing page loads complete in under 500 ms server-side, regardless of how many ideas exist in total, for any combination of filters and any page.
- **SC-005**: Reviewers viewing any idea detail can answer "who decided this, when, with what comment?" without leaving the page, in under 10 seconds, by reading the History tab.
- **SC-006**: An Admin can produce a CSV of all ideas in a chosen date range in under 10 seconds for datasets up to 10 000 rows and the file opens cleanly in a stock spreadsheet application with no parsing errors.

## Assumptions

- Edit/delete is restricted to the `SUBMITTED` status; once a reviewer has clicked "Start review" (moving the idea to `UNDER_REVIEW`), the author can no longer edit or delete. This matches the existing state-machine guard `IDEA_ALREADY_DECIDED` philosophy: once review work has begun the artefact is locked.
- The History tab is per-idea and renders on the idea detail page; it is not a global activity feed. A global activity feed (e.g. "all my activity across all ideas") is out of scope for v1.
- Page size defaults to 20 rows and the user can switch between 20 / 50 / 100. Default ordering is "newest submitted first" everywhere, matching the existing listings.
- The CSV export covers the same scope an Admin already sees in the UI (all ideas across all authors) and does not include attachment binaries — only attachment names/sizes if a column for them is included. Attachments are not re-zipped or attached to the export.
- Search is server-side (so it honours per-role scoping and pagination); the UI debounces input to avoid request floods.
- Date-range filtering applies to the idea's submission timestamp; future stories may add filtering on `decided_at`.
- Existing role guards, error-handling middleware, and audit-log infrastructure are reused; this feature adds no new authentication mechanism.
- Existing storage (SQLite via Drizzle) is sufficient at the target scale (≤ 10 000 ideas); no new database engine is introduced.
- Deletion is a hard delete of `ideas`, `idea_answers`, and the associated attachment row; the `status_transitions` rows tied to the deleted idea are dropped as well (cascade) because the user-visible idea no longer exists. Compliance-grade tamper-evident retention is out of scope for v1.
