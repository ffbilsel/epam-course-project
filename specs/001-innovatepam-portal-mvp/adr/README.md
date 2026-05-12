# Architecture Decision Records — InnovatEPAM Portal MVP

This directory contains MADR-style ADRs that record the **load-bearing
architectural choices** for the Phase 1 MVP. Each ADR distills one
research decision from [`../research.md`](../research.md) into a
canonical, link-stable format so that downstream specs, code reviews,
and future migrations can reference a single durable identifier
(`ADR-NNNN`).

## Index

| ID                          | Status   | Title |
|---|---|---|
| [ADR-0001](./0001-rendering-and-framework.md) | Accepted | Next.js 14 App Router with React Server Components |
| [ADR-0002](./0002-storage-and-orm.md)         | Accepted | SQLite via better-sqlite3, Drizzle ORM |
| [ADR-0003](./0003-authentication.md)          | Accepted | NextAuth v5 + Credentials, DB sessions, argon2id |
| [ADR-0004](./0004-state-machine.md)           | Accepted | Idea state machine as a pure function with audit log |
| [ADR-0005](./0005-attachment-storage.md)      | Accepted | Local filesystem attachments with stage-then-commit |
| [ADR-0006](./0006-validation-and-errors.md)   | Accepted | Zod-everywhere + central error-code registry |
| [ADR-0007](./0007-ui-and-design-system.md)    | Accepted | Tailwind + shadcn/ui + sonner, RSC-first composition |

## Conventions

- **Format**: lightweight MADR (Status / Context / Decision /
  Consequences / Alternatives).
- **Numbering**: 4-digit, gap-free, never reused.
- **Status transitions**: Proposed → Accepted → Superseded by
  `ADR-NNNN`. Once an ADR is Accepted it is immutable except for
  status updates and link fixes.
- **Source of truth**: when an ADR contradicts code, the ADR wins —
  open a new ADR to change direction.
