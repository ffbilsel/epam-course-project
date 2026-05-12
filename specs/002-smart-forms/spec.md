# Feature Specification: Smart Submission Forms

**Feature Branch**: `002-smart-forms`
**Created**: 2026-05-12
**Status**: Draft
**Input**: User description: "Phase 2: Smart Submission Forms (~30 min) — Dynamic forms that adapt based on idea category."

## Overview

InnovatEPAM Portal Phase 1 captured every idea with the same three free-text
fields (title, description, single attachment) regardless of category. This
forced employees to either over-share generic context or omit information
that evaluators actually need to make a decision.

Phase 2 replaces the one-size-fits-all idea form with a **category-aware**
("smart") submission form. When an employee selects a category, the form
extends itself with a small, curated set of structured questions tailored
to that category. The structured answers travel with the idea and surface
in the detail view so reviewers can compare apples to apples within a
category.

This feature is purely additive to Phase 1: it does not change the idea
state machine, the attachment rules, the role model, or the category
lifecycle (`ACTIVE` / `PROPOSED` / `REJECTED`).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Employee fills category-specific fields while submitting (Priority: P1)

An employee starts a new submission and picks a category. As soon as the
category is chosen, the form reveals the extra questions configured for
that category (for example, *Process Improvement* asks for the current
process, the pain point, and an estimated time saved per week). The
employee fills the structured questions inline, attaches the single
allowed file from Phase 1, and submits.

**Why this priority**: This is the headline value of the phase — the
idea form must adapt to the chosen category before anything else is
useful. Without it there is no "smart" form.

**Independent Test**: Can be fully tested by logging in as an Employee,
picking each of the seeded `ACTIVE` categories one after another in the
new-idea form, and asserting that the additional fields shown match the
schema configured for that category, that validation blocks submission
when required category fields are empty, and that a successfully
submitted idea persists the structured answers.

**Acceptance Scenarios**:

1. **Given** an Employee is on the new-idea form with no category yet
   selected, **When** they pick a category that has additional fields,
   **Then** those fields appear inline below the category selector
   without a full-page reload, in the order defined by the category,
   each labelled and (where applicable) marked as required.
2. **Given** the additional fields for the selected category are
   visible, **When** the Employee changes the category to a different
   one, **Then** the previously shown extra fields are hidden and any
   values they held are discarded for fields that do not exist on the
   new category; fields that exist on both categories under the same
   key retain their value.
3. **Given** the selected category has at least one required additional
   field left blank, **When** the Employee submits, **Then** submission
   is rejected with a per-field error message and the idea is not
   created.
4. **Given** all required core and category fields are valid, **When**
   the Employee submits, **Then** the idea is created in `SUBMITTED`
   state with its structured answers stored against the idea and the
   confirmation page shows the answers grouped under the category
   name.
5. **Given** the Employee chose a category in `PROPOSED` state (newly
   proposed by them at submission time, per Phase 1), **When** the
   form renders, **Then** no category-specific fields are shown (a
   proposed category has no schema yet) and submission succeeds with
   only the core fields, matching Phase 1 behaviour.

---

### User Story 2 — Reviewer sees structured answers on the idea detail page (Priority: P1)

When a Reviewer or Admin opens an idea, the detail page shows the
structured answers underneath the description, grouped under the
category's name, with the same labels the employee saw. Empty optional
answers are omitted. This lets reviewers scan a queue of ideas in the
same category and compare them on the same dimensions.

**Why this priority**: Capturing answers is only valuable if they reach
the decision-makers. Without this story, Phase 2 has no impact on
review quality.

**Independent Test**: Can be tested by seeding an idea with structured
answers for a known category, logging in as Evaluator and as Admin, and
verifying that the detail page renders the answers in the configured
order with the configured labels, and that copy/paste of the page text
preserves question/answer pairing.

**Acceptance Scenarios**:

1. **Given** an idea was submitted with three structured answers,
   **When** a Reviewer opens its detail page, **Then** a section
   headed with the category's display name (e.g. *"Process
   Improvement"*) lists each label followed by its value in the
   order configured for the category.
2. **Given** an idea was submitted before Phase 2 (it has no structured
   answers), **When** any role opens its detail page, **Then** the
   category-details section is hidden entirely (no empty header).
3. **Given** an idea has answers whose field has since been removed
   from the category schema, **When** the detail page renders, **Then**
   the orphaned answers are still shown under their last known label
   so that no review-time information is lost.

---

### User Story 3 — Admin manages the field schema of a category (Priority: P2)

An Admin opens the category management screen from Phase 1 and, for a
category in `ACTIVE` state, edits its set of additional fields. They
can add, rename, reorder, and remove fields; for each field they pick
the label, the input type (short text, long text, number, single-choice
from a fixed list, or yes/no), and whether it is required.

**Why this priority**: P1 stories can ship with a fixed, seeded schema
per category. Admin-side editing is what makes the system maintainable
beyond launch day, but is not on the critical path for the first demo.

**Independent Test**: Can be tested by logging in as Admin, editing the
schema of one `ACTIVE` category, then logging in as Employee and
verifying the new-idea form reflects the change on the very next visit
(no server restart, no migration).

**Acceptance Scenarios**:

1. **Given** an Admin is editing an `ACTIVE` category, **When** they
   add a required short-text field labelled "Estimated effort" and
   save, **Then** every subsequent new-idea form that selects this
   category shows the new field as required.
2. **Given** an Admin removes a field that historical ideas have
   answered, **When** they save, **Then** new submissions no longer
   show the field but existing ideas keep their stored answer (per
   Story 2 scenario 3).
3. **Given** an Admin tries to mark a single-choice field as required
   without supplying any options, **When** they save, **Then**
   validation blocks the save with an inline error and the schema is
   not changed.
4. **Given** a non-Admin user attempts to reach the schema editor URL,
   **When** the request hits the server, **Then** it is denied with
   the same authorisation behaviour the rest of the admin area uses in
   Phase 1.

---

### Edge Cases

- **Category becomes `REJECTED` between form load and submit.** The
  submission is rejected with a clear message that the category is no
  longer accepting ideas, matching Phase 1 behaviour; structured
  answers are discarded.
- **Category schema changes between form load and submit.** The server
  validates against the schema at the moment of submission, not the
  one cached by the browser; missing newly-required fields cause a
  validation error and the form re-renders with the fresh schema.
- **Very long answers in long-text fields.** Each long-text answer is
  capped at the same limit as the Phase 1 description field; over-long
  values produce a per-field validation error.
- **Schema with zero fields.** An `ACTIVE` category whose schema is
  empty behaves exactly like Phase 1 — no extra section is rendered,
  no extra validation runs.
- **Duplicate field keys within one category.** Prevented at schema
  edit time; an Admin cannot save a schema with two fields sharing the
  same key.
- **Single-choice options changing after the fact.** If an idea's
  stored answer is no longer one of the current options, the detail
  view still displays the original answer text verbatim (Story 2
  scenario 3 applies).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each category MUST be able to carry an ordered list of
  zero or more additional field definitions ("category field
  schema").
- **FR-002**: A field definition MUST specify a stable key, a
  human-readable label, an input type from {short text, long text,
  number, single choice, yes/no}, a required flag, and — for single
  choice — a non-empty list of options with stable values and
  human-readable labels.
- **FR-003**: The new-idea form MUST render the additional fields of
  the selected category inline, in the configured order, without
  reloading the page, and MUST hide them when no category is
  selected.
- **FR-004**: Changing the selected category on the new-idea form
  MUST preserve the values of fields that exist (by key) on both the
  old and the new category, and MUST discard values for keys that do
  not exist on the new category.
- **FR-005**: The server MUST validate every submitted idea against
  the category field schema at the moment of submission, including
  required-field checks, type checks, length limits, numeric range,
  and (for single choice) membership in the current option list.
- **FR-006**: Successful submission MUST persist the structured
  answers alongside the idea so that re-opening the idea later
  returns exactly the same answers.
- **FR-007**: The idea detail page MUST display the structured answers
  in the configured order, with their configured labels, in a section
  labelled with the category's display name; the section MUST be
  hidden when the idea has no structured answers.
- **FR-008**: When a stored answer's underlying field has been removed
  from the category schema, the detail page MUST still display the
  answer using the label that was in effect when the answer was
  saved.
- **FR-009**: Admins MUST be able to view, add, rename, reorder, and
  remove fields on any `ACTIVE` category through the existing admin
  category management surface; no other role MUST be able to.
- **FR-010**: Editing a category schema MUST NOT mutate or delete
  structured answers stored against existing ideas.
- **FR-011**: A category in `PROPOSED` state MUST NOT expose a schema
  editor and MUST render with no additional fields on the submission
  form.
- **FR-012**: All Phase 1 contracts that do not concern the schema —
  idea state machine, attachment rules, role guards, audit logging —
  MUST continue to behave exactly as they did in Phase 1.

### Key Entities

- **Category Field Definition**: An ordered element of a category's
  schema; identified by a stable key unique within the category;
  carries label, input type, required flag, and (for single choice)
  options.
- **Idea Structured Answer**: A value submitted by an Employee for one
  Category Field Definition; bound to the idea and to the field key;
  preserves the label seen at submission time so that historical
  display survives later schema edits.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An Employee can submit an idea in any seeded category
  with all category-specific fields filled in **under 90 seconds**
  starting from the empty new-idea form.
- **SC-002**: After selecting or changing a category, the additional
  fields appear or update **within 200 ms** on a typical workstation,
  with no full-page navigation.
- **SC-003**: 100% of ideas submitted after this feature ships carry
  the structured answers required by their category's schema at
  submission time (zero ideas in violation of required-field rules).
- **SC-004**: Reviewers report — in a short post-launch survey of
  Evaluators and Admins — that they can decide on an idea **without
  asking the submitter for more information** in at least **70%** of
  cases, up from a Phase 1 baseline measured the week before launch.
- **SC-005**: Admins can add a new required field to an `ACTIVE`
  category and see it on the live new-idea form **within one minute**
  of saving, with no deployment.

## Assumptions

- The five seeded categories from Phase 1 (Process Improvement,
  Product Innovation, Tooling, Customer Experience, Other) will each
  receive an initial, opinionated schema as part of this feature's
  rollout; the exact field list per category is a content decision
  made during implementation and is not part of this spec.
- The single-attachment rule from Phase 1 is unchanged in Phase 2;
  multi-attachment support is the scope of Phase 3.
- Draft management is out of scope; partially-filled smart forms are
  not persisted between sessions (that is the scope of Phase 4).
- Structured answers are not used for scoring or analytics in this
  phase; they are display-only for reviewers (scoring is Phase 7).
- Browser support, accessibility standards, localisation of labels,
  and authentication are inherited unchanged from Phase 1.
- The total number of additional fields per category is expected to
  stay small (a single-digit count) in normal usage; the system is
  not required to optimise for hundreds of fields per category.
