# ADR-0012: Ship exactly five field types as a discriminated union; further types require a new ADR

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-004](../research.md#r-004--what-field-types-ship-in-phase-2-and-how-is-the-taxonomy-extensible-without-an-adr-per-future-type)

## Context

Picking the field-type taxonomy is a load-bearing choice: it
shapes the discriminated union in TypeScript, the Zod builder,
the renderer, the OpenAPI contract, and the error-code surface.
Adding too many types up front bloats every layer for marginal
value; shipping too few leaves the feature toothless.

The spec gives concrete examples — current process narrative,
pain-point summary, estimated hours saved per week, audience
selector, customer-facing flag — which between them exercise
free text (short and long), numeric input with bounds, single
choice from a fixed list, and boolean.

## Decision

Ship **exactly five** field types in Phase 2. Each is a tag in a
discriminated union over `type`; the renderer and the Zod builder
both `switch` on the tag with no default branch (compile-time
exhaustiveness under `noFallthroughCasesInSwitch`).

| Tag             | Renderer (shadcn)     | Stored as | Constraints                                      |
|-----------------|-----------------------|-----------|--------------------------------------------------|
| `SHORT_TEXT`    | `Input`               | `string`  | trimmed, ≤ 120 chars (aligns with idea title cap) |
| `LONG_TEXT`     | `Textarea`            | `string`  | trimmed, ≤ 2 000 chars (aligns with idea desc.)  |
| `NUMBER`        | `Input type=number`   | `number`  | finite; optional `min`/`max`                      |
| `SINGLE_CHOICE` | `RadioGroup`          | `string`  | value ∈ option `value`s at submission time        |
| `YES_NO`        | `Switch`              | `boolean` | —                                                 |

Adding a new type later requires:
1. A new tag added to the union in `src/lib/validation/category-fields.ts`.
2. A new branch in the Zod builder.
3. A new branch in `DynamicFieldRenderer`.
4. A new branch in the schema editor's "Add field" menu.
5. **A new ADR that supersedes ADR-0012** (per Constitution IX —
   the taxonomy is load-bearing).

## Consequences

**Positive**

- Five tags cover every example in the spec without inventing
  scope.
- Discriminated union + `noFallthroughCasesInSwitch` makes "did
  every consumer learn about the new tag?" a compile-time gate.
- Reuses the Phase 1 length budgets (120/2 000) so a single
  error code `IDEA_ANSWER_TOO_LONG` covers all string overflows.

**Negative**

- Three commonly-requested types are **not** in Phase 2:
  - **Date / DateTime** — locale and timezone scope is too large
    for a ~30 min phase; deferred.
  - **Multi-select** — adds collection-cardinality semantics that
    significantly enlarge the validator and the OpenAPI schema;
    deferred.
  - **File** — Phase 3 owns multi-attachment; building a second
    file-storage path here would conflict.

## Alternatives considered

1. **A free-form `metadata` JSON blob per field.** Rejected:
   defeats the typing story, leaks UI concerns into the
   validator, and gives reviewers no display contract.
2. **Ship seven types including Date and Multi-select today.**
   Rejected: would push the phase well past the time budget the
   TODO names ("~30 min") and would add validator branches whose
   only spec justification is "we might need them".
3. **Generate types from JSON Schema annotations.** Rejected: see
   ADR-0011 — we keep Zod as the only validator.
