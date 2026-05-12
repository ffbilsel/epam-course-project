<!--
SYNC IMPACT REPORT
==================
Version change: 1.3.0 → 1.4.0
Bump rationale: Added two substantive new principles — IX. ADR-Backed
Design Choices and X. Feature Merge Discipline. IX makes Architecture
Decision Records the canonical record for every load-bearing design
choice, with a fixed location, MADR template, and immutability rule.
X defines the end-of-feature workflow: every feature branch MUST be
merged back to `main` via a non-fast-forward merge once the SpecKit
lifecycle for that feature reaches `/speckit.implement` completion
and all gates pass. Adds Quality Gates #11 (ADR coverage) and #12
(feature merge-back). No existing principle removed or redefined.
Per governance versioning policy this is a MINOR bump.

----- Previous report (v1.3.0) -----
Version change: 1.2.0 → 1.3.0
Bump rationale: Added a substantive new principle (VIII. Commit &
Push Discipline) that codifies the existing operational expectation
that each meaningful unit of work is captured as a Conventional-Commit
and pushed to `origin` immediately, so review history mirrors the
actual SpecKit lifecycle. Introduces a matching quality gate (#10) and
names the two automation surfaces that enforce it: the SpecKit
`auto_commit` map in `.specify/extensions/git/git-config.yml`, and the
`.git/hooks/post-commit` push hook installed via `npm run setup:hooks`
(or `pwsh scripts/install-hooks.ps1`). No existing principle removed
or redefined. Per governance versioning policy this is a MINOR bump.

----- Previous report (v1.2.0) -----
Version change: 1.1.0 → 1.2.0
Bump rationale: Added a substantive new principle (VII. Consistency —
UI, Code, and Error Codes) that consolidates and extends consistency
requirements scattered across Principles I, IV, and VI. Introduces a
binding error-code taxonomy (stable string codes, central registry,
machine-readable error envelope) that did not previously exist, plus
explicit cross-cutting code-style and UI-pattern rules. Added a
matching quality gate (#9 — error-code registry & consistency check).
No existing principle removed or redefined. Per governance versioning
policy this is a MINOR bump.

Modified principles:
  - I. Clean Code — unchanged
  - II. TypeScript with Strict Mode — unchanged
  - III. Testing Pyramid with 70% Business-Logic Coverage — unchanged
  - IV. JSDoc Documentation for All Code — unchanged
  - V. Testing Principles — unchanged
  - VI. User Experience — unchanged

Added sections:
  - VII. Consistency — UI, Code, and Error Codes (NON-NEGOTIABLE)
  - Development Workflow & Quality Gates: gate #9 (error-code registry
    & consistency check)

Removed sections:
  - None

Templates requiring updates:
  - ✅ .specify/templates/plan-template.md (Constitution Check is generic;
       gates are derived from this file at plan time — no edits required)
  - ✅ .specify/templates/spec-template.md (no constitution-specific refs)
  - ✅ .specify/templates/tasks-template.md (no constitution-specific refs)
  - ⚠ README.md / docs/quickstart.md — not yet present; create when runtime
       guidance docs are added.

Deferred / Follow-up TODOs:
  - Create `src/lib/errors/codes.ts` with the canonical error-code enum
    and `src/lib/errors/registry.md` documenting each code, when the
    Next.js project is scaffolded.
  - Add a CI script (`npm run check:error-codes`) that fails when an
    error code appears in code but is missing from the registry, or
    vice versa.
  - Add a CI script (`npm run check:ui-tokens`) that fails on
    hard-coded color hex values, magic spacing numbers, or
    non-shadcn primitive components in `src/app/**` and
    `src/components/**` (excluding `src/components/ui/**`).
-->

# InnovatEPAM Portal Constitution

## Core Principles

### I. Clean Code (NON-NEGOTIABLE)

All production code MUST adhere to clean code practices:

- Names MUST reveal intent; abbreviations and single-letter identifiers are
  prohibited outside of conventional loop indices and well-known math
  symbols.
- Functions MUST do one thing, stay small (target ≤ 30 logical lines), and
  keep cyclomatic complexity ≤ 10. Functions exceeding these limits MUST be
  refactored or explicitly justified in code review.
- Modules MUST follow the Single Responsibility Principle; cross-cutting
  concerns MUST be isolated behind explicit interfaces.
- Dead code, commented-out code, and TODOs without an issue link are
  prohibited in `main`.
- Duplication MUST be removed (DRY) once the same logic appears a third
  time; premature abstraction is equally discouraged (YAGNI).

**Rationale**: Readability and maintainability dominate the total cost of
software. Enforcing clean code at the principle level prevents accumulation
of structural debt that later blocks delivery.

### II. TypeScript with Strict Mode

All source code (UI, server actions, API route handlers, domain logic) MUST
be written in TypeScript with the strict compiler family enabled. The
repository's `tsconfig.json` MUST set, at minimum:

- `"strict": true` (enables `strictNullChecks`, `noImplicitAny`,
  `strictFunctionTypes`, `strictBindCallApply`,
  `strictPropertyInitialization`, `alwaysStrict`,
  `useUnknownInCatchVariables`).
- `"noUncheckedIndexedAccess": true`
- `"noImplicitOverride": true`
- `"noFallthroughCasesInSwitch": true`
- `"exactOptionalPropertyTypes": true`

Use of `any`, non-null assertions (`!`), and `@ts-ignore` is prohibited;
`@ts-expect-error` MAY be used only with an inline justification comment
and a linked issue. External or untyped data (HTTP request bodies, query
params, file metadata, third-party responses) MUST cross the type boundary
through a validated parser (Zod) — not casts.

**Rationale**: Strict typing eliminates entire classes of runtime defects
at build time and makes refactors safe, which is foundational to the other
principles.

### III. Testing Pyramid with 70% Business-Logic Coverage

Automated testing MUST follow the testing pyramid:

- **Unit tests** form the base: fast, isolated, no I/O, no network. They
  MUST cover all business logic (domain services, pure functions, Zod
  validators, server-action use-cases) with **≥ 70% line coverage**.
  Coverage MUST be measured and enforced in CI; PRs that drop
  business-logic coverage below the floor MUST fail.
- **Integration tests** form the middle layer: verify contracts between
  modules, route handlers via the Next.js request pipeline, and repository
  methods against a real SQLite database (file in a temp directory,
  migrated per suite). Coverage threshold for adapters: meaningful
  per-contract tests; no numeric percentage required.
- **End-to-end tests** form the tip: cover critical user journeys only via
  Playwright. They MUST remain a small minority of total test count.

The 70% threshold applies to business-logic packages (`src/server/**`,
`src/lib/**` excluding pure utility re-exports). UI glue, generated code,
and shadcn/ui components copied verbatim are exempt but MUST be excluded
explicitly via coverage configuration.

**Rationale**: The pyramid keeps the test suite fast and reliable while
the coverage floor on business logic guards the highest-value code paths
against regressions.

### IV. JSDoc Documentation for All Code

Every exported symbol — functions, classes, methods, types, interfaces,
enums, and module-level constants — MUST carry a JSDoc block that
includes:

- A one-sentence summary describing intent (not restating the signature).
- `@param` for every parameter with type-meaningful description.
- `@returns` for non-void functions.
- `@throws` for any error type a caller is expected to handle.
- `@example` for any public API surface or non-obvious utility.

Internal (non-exported) symbols MUST be documented when their purpose is
not self-evident from the name and signature. React components exported
from `src/components/**` MUST document their props via JSDoc on the props
type/interface. Documentation MUST be kept in sync with code; stale JSDoc
is treated as a defect. Linting MUST enforce JSDoc presence on exported
symbols (e.g., `eslint-plugin-jsdoc`).

**Rationale**: Inline contract documentation accelerates onboarding,
makes generated API docs trustworthy, and complements TypeScript types
with behavioural intent.

### V. Testing Principles

This principle operationalises Principle III. Where the two overlap,
Principle V's specific rules govern.

#### V.1. Testing Philosophy

- **Test-Driven Development (TDD) is RECOMMENDED**, not mandatory. The
  preferred workflow for new business logic is **RED → GREEN → REFACTOR**:
  1. **RED**: write a failing test that expresses one behavioural
     requirement.
  2. **GREEN**: write the minimum production code that makes the test
     pass.
  3. **REFACTOR**: improve structure with the test suite green; repeat.
- Tests SHOULD be derived from specifications (`specs/**/spec.md`,
  acceptance criteria, ADRs) rather than from reading the implementation.
  Mirroring the implementation produces tautological tests and is
  prohibited (see V.7).
- A PR MAY land production code and tests in the same commit, but every
  business-logic change MUST ship with tests in the same PR.

**Rationale**: TDD constrains design toward testability. Recommending
rather than mandating it suits a course-project pace while still
forbidding "tests-as-afterthought" merges.

#### V.2. Coverage Requirements

- **Pyramid distribution** (by count, measured at suite level):
  - **~70%** unit tests
  - **~20%** integration tests
  - **~10%** end-to-end tests

  Deviations beyond ±10 percentage points on any tier MUST be justified
  in a PR description.
- **Tier responsibilities**:
  - **Unit** (`tests/unit/**`): pure functions, domain services, business
    logic, Zod validators, formatters, permission/role checks. No I/O,
    no network, no database, no clock dependency without injection.
  - **Integration** (`tests/integration/**`): Next.js route handlers and
    server actions exercised through the request pipeline; repository
    methods against a real SQLite database (file in a temp directory,
    migrations applied per suite); middleware composition.
  - **E2E** (`tests/e2e/**`): critical user journeys end-to-end through
    the running Next.js app via Playwright (e.g., submit-idea →
    list-my-ideas → admin-evaluate). Kept ≤ 5 scenarios.
- **Static analysis** (gate before tests run):
  - `tsc --noEmit` with the strict configuration in Principle II.
  - `eslint .` with `@typescript-eslint/recommended-type-checked` and a
    JSDoc plugin configured; zero errors, zero warnings on protected
    branches.
- **Coverage targets** (enforced in CI, MUST fail the build below floor):
  - **70% line** on `src/server/**` and business-logic modules under
    `src/lib/**`.
  - Branch coverage is reported but not gated.
  - Mutation testing is **not** required for this project.

  `src/app/**` page/layout files, `src/components/ui/**` (shadcn-generated
  components), and generated code are excluded from line thresholds via
  `coverage.exclude` in `vitest.config.ts`. Any new excluded path MUST
  be documented in the plan's Constitution Check.

#### V.3. Test Types & Organization

Repository layout (relative to `project/`):

```text
tests/
  unit/**/*.test.ts          # mirrors src/ structure
  integration/**/*.test.ts   # grouped by feature
  e2e/**/*.spec.ts           # Playwright specs grouped by user journey
```

- **Unit tests MUST mirror `src/`**. For `src/<area>/<name>.ts` create
  `tests/unit/<area>/<name>.test.ts`. One test file per source file.
- **Integration tests MUST be grouped by feature**, not by file (e.g.,
  `tests/integration/ideas-create.test.ts`,
  `ideas-evaluate.test.ts`, `attachments-upload.test.ts`). A `_setup.ts`
  per directory MAY provide shared SQLite/migration bootstrap.
- **E2E tests MUST be grouped by user journey** (e.g.,
  `tests/e2e/employee-submit-idea.spec.ts`,
  `admin-evaluate-idea.spec.ts`). Each `test.describe` inside corresponds
  to one journey.
- The Vitest `include` and Playwright `testDir` patterns are the single
  source of truth for discovery. Files placed outside these patterns are
  not tests and MUST NOT contain test assertions.

#### V.4. Naming Conventions

- **File names**:
  - Unit / integration: `<ComponentName>.test.ts` matching the unit
    under test (e.g., `idea-validator.test.ts`,
    `ideas-create.test.ts`). React component tests use the component
    file name (e.g., `IdeaCard.test.tsx`).
  - E2E: `<user-journey-name>.spec.ts` in kebab-case
    (e.g., `employee-submit-idea.spec.ts`). Project convention is
    `.test.ts` for Vitest tiers and `.spec.ts` for Playwright; do not
    mix them without amending this constitution and the relevant config.
- **Test suites** (`describe`): the production symbol or feature name —
  `describe('IdeaValidator', …)`, `describe('POST /api/ideas', …)`,
  `describe('Submit Idea journey', …)`.
- **Test cases** (`it` / `test`): start with `should` and state the
  observable outcome and its trigger —
  `it('should reject submission when title is empty', …)`,
  `it('should return 403 when employee evaluates own idea', …)`.
- Test names MUST NOT include implementation detail (private helper
  names, internal flags).

#### V.5. Test Anatomy

- **Arrange-Act-Assert (AAA) is the required pattern.** Each test MUST
  be visibly divided into the three phases, in order, with blank lines
  or comments separating them when not otherwise obvious.
- **Setup uses `beforeEach`, not `beforeAll`**, except for *immutable*,
  process-wide resources (e.g., loaded Zod schemas). Mutable state — DB
  rows, in-memory fakes, mocked clocks — MUST be (re)created in
  `beforeEach` and torn down in `afterEach`.
- **Each test MUST be independent** and runnable in isolation
  (`vitest -t "test name"` MUST pass for any single test). Vitest's
  randomized order (`--sequence.shuffle`) MUST NOT change outcomes.
- **No shared mutable global state.** Module-level `let` variables that
  carry test data between cases are prohibited. Use factories
  (`createTestIdea()`) returning fresh objects.
- **Async tests MUST `await`** their actions and assertions; bare
  promise returns without assertion-on-resolution are not permitted.

#### V.6. Mocking & Test Data

Choose the lightest double that gives a reliable test:

- **Mock**: external services that the project does not own — outbound
  email/notification clients, any third-party HTTP API. Replace at the
  adapter boundary (`src/server/infra/**`), never deeper.
- **Stub**: time-dependent functions and non-determinism — `Date.now()`,
  `setTimeout`, `crypto.randomUUID`. Inject a `Clock` interface and an
  ID-generator port; tests pass fakes.
- **Fake**: in-memory implementations of repository ports for unit-level
  service tests (e.g., an in-memory `IdeaRepo` for
  `idea.service.test.ts`). Fakes MUST satisfy the same interface as the
  real implementation.
- **Test fixtures**: complex domain objects (submitted idea, evaluated
  idea, idea with attachments) MUST be built by helpers, not literals
  duplicated across files. Helpers live alongside the consuming tier
  (e.g., `tests/integration/_setup.ts`, `tests/unit/_factories.ts`).
- **Required helpers** (add as needs arise): `createTestUser()`,
  `createTestIdea()`, `createEvaluatedIdea()`, `signInAs()` (Playwright).
- **DO NOT mock code you own** (domain services, your own repositories
  when integration-testing them, validators). Do not mock simple
  utilities (Zod schemas, pure formatters, `lib/utils`).

#### V.7. Quality Criteria (CRITICAL)

A test that does not satisfy every rule below is a defect, regardless
of whether it is green.

**What makes a good test**:

- Tests **observable behaviour** — inputs/outputs at the unit's public
  surface, HTTP status + body shape, persisted row state, rendered DOM
  output — never private methods, internal field names, or "the function
  was called" assertions on internal helpers.
- Has **meaningful assertions**. Tautological assertions
  (`expect(x).toBe(x)`, `expect(value).toEqual(value)`,
  `expect(result).toBeDefined()` as the *only* assertion) are
  prohibited.
- Tests **one thing** — one logical assertion of behaviour per `it`.
  Multiple `expect` calls are permitted only when they collectively
  describe a single outcome (e.g., status + body).
- Is **fast**: < 1 s per unit test, < 5 s per integration test.
- Is **deterministic**: same result on every run, in every order, on
  every machine. Time, randomness, and concurrency MUST be controlled
  via injected ports.

**Quality gates** (CI-enforced):

- **No tautological assertions** — enforced via lint rules where
  available; reviewers MUST reject in code review otherwise.
- **All oracle values validated by a human reviewer.** Expected values
  in assertions (status codes, error codes, persisted shapes) MUST be
  traceable to the spec or contract; "snapshot until green" updates
  without spec backing are prohibited.
- **Coverage**: 70% line on business-logic paths (V.2).

**Anti-patterns — MUST NOT appear in the suite**:

- Testing private methods, private fields, or internal state.
- Tests that depend on execution order (interdependent tests).
- Brittle tests that break on pure refactors (renaming a private
  helper, re-ordering pure expressions).
- Flaky tests (intermittent failures): a flake MUST be quarantined
  within the same PR that detects it and fixed within one sprint, or
  the test deleted.
- Tests without assertions (or with only `expect(...).not.toThrow()` as
  the sole assertion when a stronger oracle is available).
- Copy-pasted test logic — extract a helper or `it.each` /
  `describe.each` table once duplication appears a second time.

#### V.8. Tools & Frameworks

The toolchain below is the canonical one for this repository.
Substitutions require a constitution amendment.

**Static analysis**:

- **Type checker**: TypeScript `~5.4` in strict mode (see Principle II).
- **Linter**: ESLint `^8.57` with `@typescript-eslint/parser`,
  `@typescript-eslint/eslint-plugin`, `eslint-plugin-jsdoc`, and the
  `eslint-config-next` preset. Prettier `^3.3` enforces formatting;
  warnings MUST be treated as errors on protected branches.

**Unit / Integration testing**:

- **Framework**: Vitest `^1.6` configured via `vitest.config.ts` with
  separate `unit` and `integration` projects (or `--project` flags).
- **React component testing**: `@testing-library/react ^16` and
  `@testing-library/user-event ^14` running on Vitest's `jsdom`
  environment.
- **Assertion library**: Vitest's built-in `expect` plus
  `@testing-library/jest-dom` matchers.
- **Mocking**: Vitest's built-in `vi.fn()`, `vi.spyOn()`, and
  `vi.mock()`. Hand-rolled fakes preferred over `vi.mock` for owned
  interfaces (see V.6).
- **HTTP integration**: invoke Next.js route handlers directly with a
  constructed `Request` object, or use `node-mocks-http` /
  `next-test-api-route-handler` as needed.
- **Database integration**: SQLite via `better-sqlite3` (or the
  project's chosen driver/ORM) opened against a unique file in a temp
  directory per suite; migrations applied before each suite, file
  deleted in `afterAll`.

**E2E testing**:

- **Framework**: Playwright `^1.45`, configured via
  `playwright.config.ts`. Tests live under `tests/e2e/` and run against
  `next start` (production build) in CI and `next dev` locally.

**Coverage & quality**:

- **Coverage tool**: Vitest's built-in V8 coverage provider
  (`@vitest/coverage-v8`). Floors per V.2, enforced via
  `coverage.thresholds` in `vitest.config.ts`.
- **Mutation testing**: not required for this project.

**Package manager**: npm (lockfile `project/package-lock.json` is the
source of truth for installed versions).

**Execution commands** (run from `project/`):

| Purpose                  | Command                              |
| ------------------------ | ------------------------------------ |
| Type check               | `npm run typecheck`                  |
| Lint                     | `npm run lint`                       |
| Format check             | `npm run format`                     |
| Run all tests + coverage | `npm test`                           |
| Run unit tests           | `npm run test:unit`                  |
| Run integration tests    | `npm run test:integration`           |
| Run E2E tests            | `npm run test:e2e`                   |
| Generate coverage report | `npm test -- --coverage`             |
| Full local pre-merge     | `npm run check`                      |

**Pre-commit hook** (recommended, configured via Husky or a simple Git
hook): `typecheck` + `lint` + `test:unit`. Integration and E2E run in
CI only to keep commits fast.

**CI/CD pipeline** (required on every PR; gating on `main`):

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run format`
5. `npm run test:unit -- --coverage`
6. `npm run test:integration`
7. `npm run test:e2e`
8. Coverage report uploaded as build artefact.

**Rationale**: Pinning the toolchain in the constitution removes
ambiguity about "what counts as a passing build" and makes drift
between local, CI, and developer machines a constitutional violation
rather than a debugging mystery.

### VI. User Experience — Responsive, Accessible, Polished (NON-NEGOTIABLE)

The portal MUST be usable on the devices and by the people who actually
need it. Functional correctness is necessary but not sufficient — every
shipped UI MUST satisfy the rules below.

#### VI.1. Responsive Design

- Every page and component MUST render correctly and remain usable at
  three reference breakpoints, tested in this order:
  - **Mobile**: 360 × 640 (smallest supported).
  - **Tablet**: 768 × 1024.
  - **Desktop**: 1280 × 800 and wider.
- Layouts MUST be **mobile-first**: Tailwind utilities MUST start with
  unprefixed (mobile) classes and add `sm:` / `md:` / `lg:` overrides
  upward. Desktop-first patterns (overriding *down* with `max-*`) MUST
  be avoided unless justified in code review.
- No horizontal scroll at any supported breakpoint. Tables, code
  blocks, and long content MUST use overflow handling (scroll within a
  container, wrap, or collapse to cards on mobile).
- Tap targets MUST be at least **44 × 44 px** on touch viewports.
- Forms MUST stack to a single column on mobile and use the correct
  HTML5 input types (`email`, `file`, `number`) so mobile keyboards
  behave correctly.

#### VI.2. Accessibility (WCAG 2.1 AA)

The baseline is **WCAG 2.1 Level AA**. Specifically:

- **Semantic HTML first.** Use the right element (`<button>`, `<a>`,
  `<nav>`, `<main>`, `<form>`, `<label>`) before reaching for ARIA. ARIA
  MUST only patch gaps in semantics, never replace them.
- **Every interactive element MUST be reachable and operable by
  keyboard alone.** Tab order MUST follow visual reading order; focus
  MUST be visible (do not remove the focus ring without an equivalent
  replacement); modals and menus MUST trap focus while open and restore
  focus to the trigger on close.
- **Every form control MUST have a programmatic label** (`<label
  for>`, `aria-label`, or `aria-labelledby`). Placeholder text is NOT
  a label.
- **Every error message MUST be announced** to assistive tech
  (`aria-live="polite"` or `role="alert"`) and associated with its
  field via `aria-describedby`.
- **Every non-decorative image MUST have meaningful `alt` text**;
  decorative images MUST use `alt=""`.
- **Color contrast** MUST meet WCAG AA (4.5:1 for normal text, 3:1 for
  large text and UI components). Color MUST NOT be the *only* signal
  of state (e.g., status badges combine color + text + icon).
- **No keyboard traps**, no `tabindex` values greater than 0, no
  `autofocus` on page load except on dedicated single-purpose pages
  (login, search).
- **Page MUST have a unique, descriptive `<title>`** and a logical
  heading hierarchy (`h1` once per page, no skipped levels).
- **Reduced-motion preference** (`prefers-reduced-motion`) MUST be
  honoured by any non-essential animation or transition.
- shadcn/ui components MUST NOT have their built-in accessibility
  primitives (Radix focus management, ARIA roles) stripped out during
  customization.

#### VI.3. UI Polish & UX Quality

Every user-facing screen MUST handle four states explicitly — none MAY
be omitted or left to the framework default:

1. **Loading state**: a skeleton, spinner, or progress indicator that
   appears within 100 ms of the action and persists until data is
   ready. Buttons that trigger network activity MUST disable
   themselves and show a busy indicator while in flight.
2. **Empty state**: when a list has zero items, the screen MUST show a
   short explanation and (where applicable) a primary call-to-action
   (e.g., "You haven't submitted any ideas yet — Submit your first
   idea").
3. **Error state**: failures MUST surface a human-readable message
   (no raw stack traces, no "Error: undefined"), MUST offer a retry
   when the operation is retryable, and MUST NOT silently swallow the
   failure.
4. **Success/confirmation state**: state-changing actions (submit,
   decide, login, logout) MUST give immediate feedback — a toast
   (`sonner`), an inline confirmation, or a navigation to a result
   page.

Additional polish requirements:

- **Visual consistency** — components MUST come from `src/components/ui/`
  (shadcn) where one exists; do not introduce ad-hoc styled
  alternatives. Spacing, radii, and color tokens MUST come from the
  Tailwind theme, not magic numbers.
- **Forms** MUST validate on blur and on submit, surface errors inline
  next to the offending field (not as a single dialog), and preserve
  user input on validation failure.
- **Destructive actions** (e.g., a future "delete idea") MUST require
  confirmation via a dialog and MUST be visually distinct (destructive
  variant).
- **Dates and times** MUST be formatted with `date-fns` to a
  human-readable form in the user's locale; raw ISO strings MUST NOT
  appear in the UI.
- **Copy** MUST be in plain language; no debug strings, no Lorem
  Ipsum, no untranslated keys (`form.error.title`) shipped to users.
- **Navigation** MUST make the user's location obvious (active nav
  state, breadcrumbs or page title) and MUST always offer a way back.

**Verification** (CI-enforced where automatable):

- `eslint-plugin-jsx-a11y` MUST run as part of `npm run lint`, with
  zero warnings on protected branches.
- The Playwright E2E suite MUST run `@axe-core/playwright` against
  every covered page; serious or critical violations MUST fail the
  build.
- Each P1 user story MUST be smoke-tested at the mobile breakpoint
  (360 × 640) in addition to desktop.
- Manual review checklist (in PR description for any UI-touching PR):
  keyboard-only walkthrough completed; tested at all three
  breakpoints; loading/empty/error/success states present;
  contrast ≥ AA; no console errors.

**Rationale**: An innovation portal that is unusable on a phone, that
traps a screen-reader user, or that leaves users staring at a blank
screen after a click is a failed product even if every API returns 200.
Elevating UX to a constitutional principle ensures it is reviewed and
gated, not assumed.

### VII. Consistency — UI, Code, and Error Codes (NON-NEGOTIABLE)

Consistency lowers cognitive load for users, reviewers, and future
maintainers. The rules below are binding across all three surfaces.

#### VII.1. UI Consistency

- **Components**: every UI primitive (button, input, dialog, table,
  badge, toast, dropdown, etc.) MUST come from `src/components/ui/`
  (shadcn/ui). Ad-hoc styled `<div>`s that re-implement an existing
  primitive are prohibited; if a needed primitive is missing, add it
  to `src/components/ui/` first.
- **Design tokens**: spacing, radii, shadow, font sizes, and colors
  MUST come from the Tailwind theme (e.g., `p-4`, `rounded-md`,
  `text-sm`, `bg-primary`). Hard-coded hex colors, arbitrary
  values like `p-[13px]`, and inline `style` props are prohibited
  outside `src/components/ui/` and a documented exception list.
- **Variants**: components with multiple visual styles MUST expose
  them via `class-variance-authority` variants, not via prop-driven
  `className` overrides at the call site.
- **Iconography**: a single icon set (`lucide-react`) MUST be used
  throughout. Mixing icon sets is prohibited.
- **Copy & terminology**: a term MUST be spelled and capitalised the
  same way everywhere ("idea" not "Idea"/"submission" interchangeably;
  "Submitted" / "Under review" / "Approved" / "Rejected" /
  "Implemented" are the canonical status labels). Sentence case for
  buttons and headings; no shouting ("SUBMIT").
- **Date & number formatting**: dates via `date-fns` with a single
  shared formatter helper (e.g., `formatDate`, `formatDateTime`);
  numbers via a single `formatNumber` helper. Inline `toLocaleString`
  calls in components are prohibited.
- **Layout**: page shells (header, sidebar, main, footer) MUST come
  from a shared layout component; pages MUST NOT re-implement chrome.

#### VII.2. Code Consistency

- **Formatting**: Prettier is the single source of truth; no manual
  alignment, no project-local style overrides except those checked
  into `.prettierrc`.
- **Lint**: ESLint configuration is centralised; per-file `eslint-
  disable` directives MUST cite a rule and a justification on the
  same line and are reviewed in PR.
- **File naming**:
  - React components: `PascalCase.tsx` (e.g., `IdeaCard.tsx`).
  - Hooks: `use-kebab-case.ts` (e.g., `use-current-user.ts`).
  - Server modules, utilities, route handlers: `kebab-case.ts`
    (e.g., `idea-service.ts`, `validate-idea.ts`).
  - Tests mirror their subject (see V.4).
- **Identifier casing**: `PascalCase` for types, interfaces, classes,
  React components; `camelCase` for variables, functions, methods;
  `SCREAMING_SNAKE_CASE` for module-level constants and enum members.
- **Imports**: ordered by `eslint-plugin-import` rules — Node built-ins,
  external packages, internal aliases (`@/...`), parent (`../`),
  sibling (`./`), styles — with a blank line between groups.
  Path aliases (`@/...`) MUST be used for all cross-directory imports;
  deep relative paths (`../../../`) are prohibited.
- **Module structure**: each file exports one primary symbol whose
  name matches the file (component, hook, service). Helpers private
  to the file stay non-exported; helpers shared across files move to
  a sibling utilities module.
- **Async style**: `async`/`await` everywhere; raw `.then()` chains
  are prohibited except inside the `Promise` adapter layer of a
  third-party API.
- **Error handling style**: throw typed errors (see VII.3); never
  return `null` to signal failure when an error is the truthful
  outcome; never swallow a caught error without re-throwing or
  recording it via the application logger.

#### VII.3. Error Codes (CRITICAL)

A stable, machine-readable error vocabulary makes the system
debuggable in production, testable in CI, and translatable in the UI.

- **Single registry**: every error code MUST be declared in
  `src/lib/errors/codes.ts` as a member of an exported `const`
  enum-like object (`as const`) with a TypeScript union type derived
  from it. Codes referenced anywhere in `src/**` that are not in the
  registry, or codes in the registry that are unused, MUST fail the
  CI consistency check (gate #9).
- **Code format**: `UPPER_SNAKE_CASE` strings, namespaced by
  capability — `<DOMAIN>_<CONDITION>`. Examples:
  - `AUTH_INVALID_CREDENTIALS`
  - `AUTH_SESSION_EXPIRED`
  - `AUTH_FORBIDDEN_ROLE`
  - `IDEA_TITLE_REQUIRED`
  - `IDEA_TITLE_TOO_LONG`
  - `IDEA_CATEGORY_INVALID`
  - `IDEA_NOT_FOUND`
  - `IDEA_ALREADY_DECIDED`
  - `IDEA_SELF_EVALUATION_FORBIDDEN`
  - `ATTACHMENT_TOO_LARGE`
  - `ATTACHMENT_TYPE_NOT_ALLOWED`
  - `RATE_LIMITED`
  - `INTERNAL_ERROR`
  Generic codes (`ERROR`, `BAD_REQUEST`, `FAILED`) are prohibited.
- **Typed error class**: a single `AppError` class in
  `src/lib/errors/app-error.ts` MUST carry: `code` (one of the
  registry union), `httpStatus` (HTTP status to render for this
  code), `message` (developer-facing English), optional `cause`,
  optional `details` (structured, validated payload). Domain code
  throws `AppError`; route handlers translate it to the response
  envelope.
- **API error envelope**: every non-2xx response from an API route
  or server action MUST conform to:

  ```json
  {
    "error": {
      "code": "IDEA_TITLE_REQUIRED",
      "message": "Title is required.",
      "details": { "field": "title" }
    }
  }
  ```

  Plain-text error responses, raw stack traces, and bare HTTP-status
  pages without this envelope are prohibited.
- **HTTP status mapping**: each code MUST map to exactly one HTTP
  status; the mapping lives next to the code in the registry and
  MUST be tested. Default mappings:
  - validation / domain-input failures → `400`
  - authentication failures → `401`
  - authorization / role failures → `403`
  - missing resources → `404`
  - state-transition / conflict failures → `409`
  - payload-too-large failures → `413`
  - rate-limit failures → `429`
  - unhandled / unexpected → `500` (`INTERNAL_ERROR` only; never
    leak underlying exception messages).
- **UI error rendering**: the UI MUST resolve `code` to a
  user-facing message via a single `errorMessages` map keyed by
  code. Components MUST NOT render raw `error.message` from the
  envelope (that is for developers, not users); they MUST look up
  the `code`. Unknown codes fall back to a generic
  "Something went wrong" message and log the unknown code.
- **Logging**: every thrown `AppError` MUST be logged with its
  `code`, `httpStatus`, `userId` (if known), and request id.
  Unhandled exceptions MUST be wrapped as `INTERNAL_ERROR` at the
  outermost boundary and the original error logged with stack.
- **Tests**: integration tests MUST assert on `error.code` (stable
  contract), not on `error.message` text (which may be reworded).
  At least one test per registered code MUST exist before the code
  may be referenced in production paths.

**Rationale**: A consistent UI feels like one product instead of a
federation of pages; a consistent codebase lets reviewers focus on
correctness instead of style; consistent error codes turn production
incidents from "grep the logs for that string" into "filter on
`code = ATTACHMENT_TOO_LARGE`" and let the UI evolve copy without
changing the API.

## Quality & Tooling Standards

- **Language & runtime**: TypeScript only for application code; Node.js
  `>=20 <21`. The Next.js build MUST type-check on every commit and in
  CI.
- **UI stack**: React 18, Tailwind CSS, and shadcn/ui. Components copied
  from shadcn/ui MAY be modified locally but MUST remain in
  `src/components/ui/` and are exempt from coverage thresholds (still
  subject to lint and type checks).
- **Data layer**: SQLite as the persistence engine. Schema changes MUST
  ship as versioned migrations; ad-hoc schema edits in production code
  paths are prohibited.
- **Validation boundary**: every server action and API route handler
  MUST validate input with Zod before reaching domain code.
- **Linting & formatting**: ESLint (with `@typescript-eslint`,
  `eslint-config-next`, `eslint-plugin-jsdoc`, and
  `eslint-plugin-jsx-a11y`) and Prettier MUST run in CI; warnings
  MUST be treated as errors on protected branches.
- **Accessibility tooling**: `eslint-plugin-jsx-a11y` MUST be enabled
  with the `recommended` ruleset; the Playwright E2E suite MUST
  integrate `@axe-core/playwright` and fail on serious or critical
  violations (see Principle VI).
- **Coverage tooling**: Vitest's V8 coverage MUST emit machine-readable
  reports and enforce the 70% line business-logic threshold via
  `coverage.thresholds` in `vitest.config.ts`, not by honour system.
- **Dependency hygiene**: Direct dependencies MUST be pinned via
  lockfile (`package-lock.json`); transitive vulnerabilities MUST be
  triaged within one sprint of disclosure.

## Development Workflow & Quality Gates

The following gates MUST pass before a change merges to `main`:

1. `tsc --noEmit` succeeds with the strict configuration above.
2. ESLint and Prettier produce zero errors.
3. Unit, integration, and E2E test suites pass.
4. Business-logic line coverage ≥ 70% on `src/server/**` and the
   business-logic subset of `src/lib/**`.
5. JSDoc lint rule passes on all exported symbols.
6. Code review by at least one other contributor (or self-review with
   written rationale, for solo course work); reviewers MUST verify
   compliance with each Core Principle and reject changes that bypass
   them without an approved justification recorded in the PR
   description.
7. Constitution Check in the planning template (see
   `.specify/templates/plan-template.md`) is satisfied or contains a
   documented complexity justification.
8. Accessibility & responsiveness checks (Principle VI) pass:
   `eslint-plugin-jsx-a11y` produces zero errors;
   `@axe-core/playwright` reports zero serious or critical
   violations; PR description includes the manual UI checklist for
   any UI-touching change. Until the a11y tooling is wired into CI,
   this gate is "advisory-failing" — PRs MUST attach the manual
   checklist; the gate becomes hard-failing as soon as the CI job
   is in place.
9. Consistency checks (Principle VII) pass:
   - Error-code registry is in sync — every code referenced in
     `src/**` is declared in `src/lib/errors/codes.ts`, and every
     declared code is either referenced in code OR covered by a
     test (no dead codes).
   - At least one test per registered error code exists.
   - UI-token check produces zero hard-coded color hex values,
     arbitrary Tailwind values (`p-[13px]`), or inline `style`
     props outside `src/components/ui/` and the documented
     exception list.
   - All non-2xx API responses conform to the error envelope
     shape (verified by integration tests).

   Until the dedicated CI scripts are wired in, this gate is
   "advisory-failing" — PRs MUST attach a manual consistency
   note in the description; the gate becomes hard-failing as soon
   as the CI jobs are in place.
10. Commit & push discipline (Principle VIII) is satisfied: every
    completed unit of work is recorded as a Conventional-Commit on
    the appropriate branch and pushed to `origin` before the work
    session ends. Reviewers MUST reject PRs whose history shows long
    "WIP" runs that were not pushed incrementally without a recorded
    justification.
11. ADR coverage (Principle IX) is satisfied: every load-bearing
    design choice introduced or changed by the PR is recorded in
    `specs/<feature>/adr/NNNN-*.md` using the MADR template, and the
    ADR index (`specs/<feature>/adr/README.md`) lists it. Code that
    contradicts an Accepted ADR without superseding it is a hard
    failure of this gate.
12. Feature merge-back (Principle X) is satisfied at end-of-feature:
    `/speckit.implement` reports green, gates 1–11 pass on the
    feature branch's HEAD, and the branch is merged into `main` with
    `git merge --no-ff` (preserving the feature topology) before the
    SpecKit lifecycle for that feature is considered closed.

## Principle VIII. Commit & Push Discipline (NON-NEGOTIABLE)

Every meaningful unit of work — a finished SpecKit step (constitution,
specify, clarify, plan, tasks, implement), a green test for a new
capability, a refactor that leaves the tree compiling — MUST be
captured as its own commit and pushed to `origin` **before the agent
or contributor moves on to the next unit**. Long-lived uncommitted
trees and unpushed local branches are forbidden.

**Rationale**: Spec-driven development depends on the ability to
replay the lifecycle from `git log` alone. A reviewer must be able to
see "spec → ADR → plan → tasks → implementation" as a sequence of
small, named commits. Local-only history defeats the SDD review
model and risks data loss on a single laptop.

**Hard rules**:

- Every commit MUST follow the Conventional Commits 1.0.0 format
  (`<type>(<scope>): <subject>`). Allowed `type`s: `feat`, `fix`,
  `docs`, `chore`, `refactor`, `test`, `build`, `ci`, `perf`. Subject
  MUST be imperative, ≤ 72 characters, no trailing period.
- The body MUST explain *why* the change is being made when the
  *what* is non-obvious. SpecKit-generated commits MUST name the
  slash command they correspond to (e.g. `/speckit.plan`).
- A commit MUST be pushed to `origin/<branch>` immediately after it
  lands locally. The only exception is when `git push` itself fails;
  in that case the failure MUST be surfaced and resolved within the
  same work session.
- The agent (Copilot or otherwise) MUST NOT require an explicit
  user instruction to commit or to push. The two automation surfaces
  named in the Sync Impact Report make this self-enforcing:
  - The SpecKit `auto_commit` map MUST stay enabled with at least
    every `after_*` event set to `enabled: true`. Disabling an entry
    requires the same amendment process as any constitutional rule.
  - The `post-commit` Git hook MUST run `git push` to the tracked
    upstream of the current branch. Operating without the hook
    installed is a Quality-Gate-#10 failure.
- Force-pushes (`git push --force` / `--force-with-lease`) are
  forbidden on `main` and on any branch that has an open PR.
- Secrets MUST NOT be committed; the `.gitignore` ships with `.env*`
  excluded and a `gitleaks` scan SHOULD run in CI.

## Principle IX. ADR-Backed Design Choices (NON-NEGOTIABLE)

Every **load-bearing design choice** MUST be recorded as an
Architecture Decision Record (ADR) before, or in the same PR as, the
code that depends on it. Verbal agreements, chat history, and prose
bodies of `plan.md` are not substitutes.

A "load-bearing design choice" is any decision a future contributor
would need to understand to safely change the system, including but
not limited to:

- Choice of framework, language version, runtime, or major library.
- Persistence engine, ORM, schema strategy, migration tooling.
- Authentication / authorization model, session strategy, password
  hashing algorithm and parameters.
- API contract style (REST/GraphQL/RPC), serialization format, error
  envelope, versioning policy.
- Cross-cutting infrastructure: caching, queues, file storage,
  rate limiting, observability stack.
- Domain-model invariants encoded as state machines.
- UI architecture: rendering model (RSC vs. SPA), design-system
  vendoring, token strategy.

**Hard rules**:

- ADRs live at `specs/<feature>/adr/NNNN-<kebab-title>.md` (gap-free
  4-digit numbering, never reused) with an index at
  `specs/<feature>/adr/README.md`. For cross-cutting decisions that
  outlive a single feature, the ADR MAY be promoted to
  `docs/adr/NNNN-*.md` once such a folder exists; until then it stays
  with its originating feature.
- ADRs MUST use the MADR-style sections **Status**, **Date**,
  **Deciders**, **Source**, **Context**, **Decision**,
  **Consequences** (positive + negative), **Alternatives considered**.
- ADR status flow: `Proposed → Accepted → Superseded by ADR-NNNN`.
  Once **Accepted**, an ADR is **immutable** except for status
  changes and link fixes; new direction is a *new* ADR that
  supersedes it.
- `plan.md` and `research.md` MAY summarise decisions, but the
  authoritative reference for each is its ADR id (`ADR-NNNN`).
  Where they conflict, the ADR wins.
- A PR that introduces or changes a load-bearing design choice
  without the matching ADR fails Quality Gate #11 and MUST be
  rejected.
- Reviewers MUST link every "why is it built this way?" review
  question to an ADR id. If no ADR covers the question, the PR
  author MUST add one in the same PR.

## Principle X. Feature Merge Discipline (NON-NEGOTIABLE)

Every SpecKit feature is developed on its numbered branch (e.g.
`001-innovatepam-portal-mvp`) and MUST be **merged back into `main`
at end-of-feature** so that `main` is always the canonical, releasable
record of the project.

**End-of-feature** means all of the following are true on the feature
branch's HEAD:

- `/speckit.implement` reports the feature complete (no outstanding
  tasks in `tasks.md`).
- Quality Gates 1–11 all pass.
- The latest commit is pushed to `origin/<feature-branch>`.

**Merge rules**:

- The merge MUST be a **non-fast-forward merge** (`git merge --no-ff`
  or the equivalent "Create a merge commit" option in the PR UI), so
  that the feature branch's topology is preserved in `main`'s
  history.
- The merge commit subject MUST follow Conventional Commits and name
  the feature: `merge(feature/NNN): <feature-name>`.
- The merge commit body MUST include:
  - A one-line summary of what shipped.
  - The list of ADR ids accepted in this feature.
  - A pointer to the spec (`specs/<feature>/spec.md`).
- Squash-merging a feature branch is **forbidden** — it destroys the
  spec→plan→tasks→implement commit narrative that Principle VIII
  exists to preserve.
- Rebase-merging is **forbidden** for the same reason.
- After the merge, the feature branch MAY be kept on `origin` for
  reference (deletion is optional). New features start a new
  numbered branch from the merge commit on `main`.
- If gates fail late and the merge cannot happen, an issue MUST be
  filed naming the failing gate; the feature is **not** considered
  closed until the merge lands.

**Rationale**: Without a discipline that brings every feature back to
`main`, long-lived branches diverge, ADRs land in branches no one
rebases against, and `main` becomes a museum piece instead of the
product. The merge commit is also the natural moment for the final
`/speckit.analyze` audit and for tagging a release.

## Governance

This constitution supersedes ad-hoc conventions and individual
preferences. Conflicts between this document and other guidance MUST
be resolved in favour of this constitution unless an amendment is
ratified.

**Amendment procedure**:

1. Open a PR modifying `.specify/memory/constitution.md` with the
   proposed change and a Sync Impact Report.
2. The PR MUST update the version number per the policy below and
   propagate changes to dependent templates and docs in the same PR.
3. At least one maintainer review is required; principle removals or
   redefinitions require maintainer consensus.

**Versioning policy** (semantic):

- **MAJOR**: Backward-incompatible governance or principle removals /
  redefinitions.
- **MINOR**: New principle or section added, or existing guidance
  materially expanded.
- **PATCH**: Clarifications, wording, typos, non-semantic refinements.

**Compliance review**: Every PR description MUST include a brief
"Constitution compliance" note. Periodic audits (at least once per
release) MUST verify that the codebase still satisfies the principles;
deviations MUST be filed as remediation issues.

**Version**: 1.4.0 | **Ratified**: 2026-05-12 | **Last Amended**: 2026-05-12
