# ADR-0002: SQLite via better-sqlite3, Drizzle ORM

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-003](../research.md)

## Context

The MVP runs as a single Node process for an internal pilot. Expected
load: a few hundred users, a few thousand ideas. We need ACID writes
(state-machine transitions + audit log), case-insensitive uniqueness
(emails, category names), foreign-key integrity, and **zero ops
overhead** for the course timeline. We also need first-class
TypeScript types for queries and a migration story we can replay in
CI.

## Decision

Persist all data in **SQLite**, accessed through **better-sqlite3**
(synchronous, single-process driver), with **Drizzle ORM** as the
query builder and **drizzle-kit** for migrations.

- DB file: `./data/innovatepam.db` (gitignored).
- Migrations: `./drizzle/` (versioned, generated, committed).
- Repositories live in `src/db/repositories/**` and only return
  typed entities; SQL never escapes that folder.
- Foreign keys are enforced (`PRAGMA foreign_keys = ON;` on every
  connection).

## Consequences

**Positive**
- Zero infrastructure to provision in dev or CI.
- `better-sqlite3` is synchronous → simpler error handling, no event
  loop hops for short queries.
- Drizzle gives us Zod-compatible inferred types and
  `drizzle-kit generate` for diff-based migrations.
- Trivial to back up (copy one file) and to reset in CI.

**Negative**
- Single-writer model; concurrent writes serialize. Acceptable for
  the MVP but a known scale ceiling.
- File I/O on `./data/` — production hosting must provide a writable
  persistent disk.
- Some ANSI SQL features (e.g. `ILIKE`) are unavailable; we standardise
  on `LOWER()` + functional indexes for case-insensitive lookups.

## Alternatives considered

- **PostgreSQL**: future-proof but adds an ops dependency that the
  course timeline does not warrant.
- **Prisma + SQLite**: similar DX, but Prisma's generated client +
  schema language is heavier and its migration model conflicts with
  our preference for hand-reviewed SQL.
- **Plain `node:sqlite`** (Node 22 built-in): not yet stable on Node
  20 LTS, and lacks Drizzle's type inference.
