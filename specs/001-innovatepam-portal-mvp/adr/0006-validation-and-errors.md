# ADR-0006: Zod-everywhere validation + central error-code registry

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-007, §R-008](../research.md), [data-model.md "Error-code surface"](../data-model.md), [Constitution VII](../../../.specify/memory/constitution.md)

## Context

Constitution VII (Consistency) mandates a single error-code registry,
a uniform error envelope `{ error: { code, message, details } }`, and
that no string error message be invented inside a route handler. We
also need to validate three different input boundaries (JSON request
bodies, multipart form data, query strings) and share schemas with
the React forms so the same constraints fire in both places.

## Decision

**Validation**: use **Zod** as the only validator across the app.

- Schemas live in `src/lib/validation/**` and are imported by both
  Route Handlers (server) and React Hook Form (client) via
  `@hookform/resolvers/zod`.
- Every Route Handler MUST `safeParse` its input. On failure it MUST
  throw a typed `AppError`, never return a hand-rolled JSON.

**Error contract**: a single registry plus a typed wrapper.

- `src/lib/errors/codes.ts` exports a `const ERROR_CODES = { … }
  as const` object listing every code and its default HTTP status.
  Adding a code is a one-line PR.
- `src/lib/errors/AppError.ts` exports `class AppError extends Error`
  with `code`, `httpStatus`, `details` fields.
- `src/lib/errors/with-error-handler.ts` exports a higher-order
  wrapper used by every Route Handler:
  ```ts
  export const POST = withErrorHandler(async (req) => { … });
  ```
  It catches `AppError` and `ZodError` and renders the canonical
  envelope; anything else becomes `INTERNAL_ERROR` (500) with the
  stack only logged server-side.
- The UI imports the same registry and the message catalogue
  (`src/lib/errors/error-messages.ts`) — never hard-codes a string.
- A CI script (`scripts/check-error-codes.ts`) fails the build if a
  code is referenced anywhere without being declared in the
  registry, or if a registered code has zero test coverage
  (Constitution Quality Gate #9).

## Consequences

**Positive**
- One source of truth for "what can go wrong"; OpenAPI references it
  by name.
- Same schema runs on client and server → the user never sees a
  field accepted on submit and rejected by the API.
- The HOC removes try/catch boilerplate and guarantees the envelope
  shape.
- The CI gate prevents code drift over time.

**Negative**
- Forces discipline: contributors must add a code before throwing.
- Two extra build steps (the two check scripts) — both run in
  ~hundreds of ms.

## Alternatives considered

- **Yup / Joi**: comparable runtime validation but weaker TS
  inference; would lose the `z.infer<typeof Schema>` round-trip we
  rely on.
- **Throw raw `Error` and let middleware sniff `instanceof`**:
  fragile, untyped, and conflicts with the registry requirement.
- **Per-feature error enums**: explicitly rejected by Constitution
  VII to avoid divergence.
