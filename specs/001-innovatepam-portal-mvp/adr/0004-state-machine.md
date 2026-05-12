# ADR-0004: Idea state machine as a pure function with append-only audit

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: InnovatEPAM Portal team
- **Source**: [research.md §R-004](../research.md), [data-model.md "Entity: Idea"](../data-model.md), [spec.md FR-018a…FR-022a](../spec.md)

## Context

Idea status is the heart of the workflow (`SUBMITTED → UNDER_REVIEW
→ APPROVED → REJECTED → IMPLEMENTED`) and is constrained by role,
self-evaluation prevention, comment requirements, and category state
(blocked while category is PROPOSED). The same rules need to be
applied in: API handlers, UI button enable/disable, and tests.

## Decision

Encode the transition rules as a **single pure function** in
`src/server/idea-state-machine.ts`:

```ts
type Decision =
  | { kind: 'allow' }
  | { kind: 'deny'; code: ErrorCode };

function evaluateTransition(input: {
  idea: { status: IdeaStatus; authorId: string; categoryState: CategoryState };
  actor: { id: string; role: Role };
  action: TransitionAction;
  comment: string | null;
}): Decision;
```

The function is **stateless and DB-free**; callers pass the data it
needs. Every status change in the DB is wrapped in a single
transaction that:

1. Re-reads the Idea + Category in the same tx.
2. Calls `evaluateTransition` again (defence-in-depth vs. concurrent
   updates).
3. Writes the new `status` + `updatedAt` on the Idea.
4. Inserts a row into `status_transitions` (the append-only audit
   log) capturing actor, from/to, comment, timestamp.

The same module exports `canTransition()` for UI button gating, so
the UI never invents its own rules.

## Consequences

**Positive**
- One source of truth for rules → matches Constitution VII
  (Consistency).
- Pure function is trivial to unit-test — every cell of the
  transition table can be enumerated in milliseconds (Constitution V).
- Audit log answers "who decided what when" without query gymnastics
  on the Idea row.
- Concurrency is contained inside a single SQLite transaction.

**Negative**
- Two writes per transition (Idea + transition row); negligible at
  expected scale.
- UI must also call the function client-side to gate buttons, which
  means the rule module must be importable from RSC + client; we
  therefore keep it free of Node-only APIs.

## Alternatives considered

- **DB triggers** to enforce transitions: opaque, hard to test,
  spreads logic across SQL and TS.
- **xstate**: powerful but overkill for ~6 states; introduces a
  visualisation/runtime dependency we do not need.
- **Letting each route handler check rules ad-hoc**: the path that
  failed in the original brainstorm — duplication and drift.
