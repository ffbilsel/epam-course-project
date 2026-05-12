# ADR-0003: NextAuth v5 + Credentials provider, DB sessions, argon2id

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-001, §R-002](../research.md), [spec.md FR-001…FR-005b](../spec.md)

## Context

The MVP must authenticate internal users with email + password
(no SSO in scope), enforce a **24-hour sliding session** with
server-side revocability, hash passwords with a modern algorithm,
and ship a **bootstrap-admin** flow driven by an environment
variable (FR-005b). Sessions must be invalidatable instantly on
role change or logout — JWTs do not satisfy that.

## Decision

Use **NextAuth.js v5** with:

- The **Credentials provider** (email + password).
- The **`@auth/drizzle-adapter`** writing sessions to the SQLite DB
  (NOT JWT) so that revoking a session is a single `DELETE`.
- The session callback **bumps `expires` to `now + 24h`** on every
  successful authenticated request, implementing the sliding window.
- Password hashing via **`argon2`** (argon2id) using the OWASP-2024
  recommended parameters: `memoryCost=19_456`, `timeCost=2`,
  `parallelism=1`.
- A startup hook reads `BOOTSTRAP_ADMIN_EMAIL`; if a matching user
  exists they are promoted to ADMIN, otherwise a marker is stored so
  the next register-with-that-email is auto-promoted (FR-005b).

## Consequences

**Positive**
- Battle-tested auth surface with CSRF + cookie hardening built in.
- DB sessions are revocable, sliding, and auditable.
- argon2id resists GPU attacks better than bcrypt at the same wall
  time.
- Bootstrap admin is reproducible across env reset (idempotent).

**Negative**
- NextAuth v5 is still in beta cadence; minor APIs may shift.
- Each authenticated request hits the DB for session lookup (SQLite
  on the same disk → negligible).
- argon2 is a native dependency; CI must build it for the runner OS.

## Alternatives considered

- **JWT sessions**: stateless, fast, but cannot be revoked without
  a denylist — adds the very state we tried to avoid.
- **Lucia**: small and modern, but Credentials/CSRF + adapters are
  less mature than NextAuth.
- **Hand-rolled auth**: too much risk surface for a course MVP.
- **bcrypt**: still acceptable but argon2id is the current OWASP
  recommendation.
