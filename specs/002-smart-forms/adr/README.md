# Architecture Decision Records — Smart Submission Forms (Phase 2)

This directory contains MADR-style ADRs for the **load-bearing
architectural choices** introduced by Phase 2. Numbering continues
gap-free from the Phase 1 ADRs in
[`../../001-innovatepam-portal-mvp/adr/`](../../001-innovatepam-portal-mvp/adr/);
the last Phase-1 ADR is `ADR-0008`, so Phase 2 starts at
`ADR-0009`.

Each ADR distils one Phase 0 research decision from
[`../research.md`](../research.md) into a canonical, link-stable
format so downstream code reviews and future migrations can
reference one durable identifier.

## Index

| ID                                                              | Status   | Title |
|-----------------------------------------------------------------|----------|-------|
| [ADR-0009](./0009-category-schema-storage.md)                   | Accepted | Store the category field schema inline as a JSON column on `categories` |
| [ADR-0010](./0010-answer-storage-and-label-snapshot.md)         | Accepted | Store structured answers inline on `ideas` with a per-answer label snapshot |
| [ADR-0011](./0011-dynamic-zod-validation.md)                    | Accepted | Build a per-category Zod schema at runtime, used by client and server alike |
| [ADR-0012](./0012-field-type-taxonomy.md)                       | Accepted | Ship exactly five field types as a discriminated union; further types require a new ADR |

## Conventions

- **Format**: lightweight MADR (Status / Date / Deciders / Source /
  Context / Decision / Consequences / Alternatives).
- **Numbering**: 4-digit, gap-free, never reused. Phase 2 continues
  the same series as Phase 1.
- **Status transitions**: Proposed → Accepted → Superseded by
  `ADR-NNNN`. Once an ADR is Accepted it is immutable except for
  status updates and link fixes.
- **Source of truth**: when an ADR contradicts code, the ADR wins —
  open a new ADR to change direction.
