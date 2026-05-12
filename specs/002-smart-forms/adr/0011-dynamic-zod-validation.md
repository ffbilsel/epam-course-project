# ADR-0011: Build a per-category Zod schema at runtime, used by client and server alike

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-003](../research.md#r-003--how-is-the-category-specific-validation-expressed-so-that-it-runs-on-both-the-client-and-the-server), [Constitution VII.3](../../../.specify/memory/constitution.md), [ADR-0006](../../001-innovatepam-portal-mvp/adr/0006-validation-and-errors.md)

## Context

The Phase 2 form changes shape with the selected category. The
project's existing validation contract (Phase 1, ADR-0006) is
"Zod-everywhere": the same schema runs on the client (via
`@hookform/resolvers/zod`) and on the server (`safeParse` in the
route handler). A dynamic form must not be allowed to break that
invariant — the client and the server must never disagree about
what counts as a valid submission.

## Decision

Introduce a **pure builder function**:

```ts
// src/lib/validation/category-fields.ts
export function buildAnswersZodSchema(
  fields: CategoryFieldDefinition[],
): z.ZodObject<Record<string, z.ZodTypeAny>>;
```

It returns a `z.ZodObject` whose shape is keyed by `field.key` and
whose per-field validator is composed from the field's `type`,
`required` flag, and (for `SINGLE_CHOICE`) `options`. Both
consumers call the *same* function:

- **Client**: `IdeaForm` calls `buildAnswersZodSchema(schemaOfSelectedCategory)` whenever the chosen category changes and feeds the result into `useForm({ resolver: zodResolver(coreSchema.merge(z.object({ answers: built }))) })`.
- **Server**: `IdeaService.create` loads the category's schema by id, calls the same builder, and runs `built.safeParse(input.answers)` before persisting. Failures are translated to the appropriate `IDEA_ANSWER_*` `AppError` with `details: { field: <key> }`.

The meta-schema (`CategoryFieldSchema`) — the validator that
verifies a *schema itself* before storage — lives in the same
file and is **not** built at runtime; it is a static Zod schema
just like every other Phase 1 validator.

## Consequences

**Positive**

- Single source of truth: the same primitive that fires on the
  client also fires on the server, eliminating drift.
- No new dependency: `zod` is already in the runtime.
- Pure-function builder is trivially testable with `it.each`
  table-driven cases.
- Type inference: `z.infer<ReturnType<typeof buildAnswersZodSchema>>`
  yields a precise per-form-instance type, although in practice
  the consumer treats it as `Record<string, string | number | boolean>`
  because the keys are not known statically.

**Negative**

- The TypeScript type of the result is dynamic (`Record<string, ...>`);
  call sites cannot rely on per-field named properties at compile
  time. Mitigated by using string-keyed access (`answers[key]`)
  throughout.
- The builder is re-invoked on every category change in the form
  hot path. Cost is microseconds for ≤ 20 fields; acceptable.

## Alternatives considered

1. **Adopt JSON Schema + `ajv`.** Rejected: splits the validator
   stack, doubles the dependency surface, and breaks Constitution
   VII's "Zod-everywhere" rule (ADR-0006).
2. **Two parallel validators (one in the form, one in the route
   handler).** Rejected: the bug ADR-0006 exists to prevent —
   client and server disagreeing on what is valid — is exactly the
   bug this approach would re-introduce.
3. **Trust the client and skip server-side answer validation.**
   Rejected: trusting the client is non-negotiable on every API
   surface in this project.
