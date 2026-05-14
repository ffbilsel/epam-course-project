# ADR-0023: Outbound mail uses nodemailer SMTP with a queued, retried, transport-injected dispatcher

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-5 design
- **Consulted**: existing `notification` requirements (FR-010..018),
  NFR-002 / NFR-003, Constitution V.6 (mocking strategy)
- **Informed**: spec FR-010..FR-018, NFR-002, NFR-003, SC-002

## Context and Problem Statement

Phase 5 introduces transactional email notifications for status
changes, comments, and ratings (FR-010..012). The spec's hard
constraints are:

- Use SMTP directly (no third-party transactional-mail SaaS — spec
  Assumption + user default this session).
- Failed email delivery MUST NOT roll back the originating domain
  transaction (NFR-003 / FR-016).
- ≥ 95 % of mails dispatched within 30 s of the event (NFR-002 /
  SC-002).
- Bulk Admin transitions collapse into per-recipient digest mails
  (FR-017).
- Outbound mail respects the anonymity policy (FR-013 / ADR-0018).

## Decision Drivers

- Replaceability of the SMTP-talking library (so unit tests don't
  open sockets).
- Independence of the email send pipeline from the domain commit.
- Bounded retry with logged exhaustion (FR-016 last sentence).
- Single in-process worker is acceptable for the spec scale (≤ 1 000
  active users); a separate worker process is out of scope.

## Considered Options

1. **`nodemailer ^6.9` behind an `EmailTransport` adapter interface;
   send driven by a queue table + setInterval worker** (Decision).
2. Synchronous send inside the domain transaction.
3. A third-party transactional-mail SaaS (SendGrid, Postmark, …).
4. A dedicated worker process (BullMQ / pg-boss style) with Redis.

## Decision Outcome

Chosen option: **#1**.

- `nodemailer ^6.9` is the SMTP-talking library; it is wrapped by
  `src/server/infra/email-transport.ts`, which exports the
  `EmailTransport` interface (`send(message): Promise<void>`) and one
  implementation (`NodemailerEmailTransport`) instantiated from env
  vars on module load. Unit tests inject a `RecordingEmailTransport`
  that appends messages to an in-memory array.
- Domain code calls `notificationService.enqueue(events)` inside the
  same transaction as the originating change (status transition,
  comment, rating). `enqueue` writes a `notification_events` row and
  a sibling `email_deliveries` row (status = `pending`, `attempt_count
  = 0`) per event whose recipient's `email_preferences` permit mail.
  If the user has the category toggled off, the delivery row is
  written with `status = 'suppressed'` so the audit answer to "why
  no mail?" exists.
- A worker started in `src/instrumentation.ts` ticks once per second
  (configurable via `NOTIFICATION_POLL_INTERVAL_MS`), runs the pure
  function `dispatchPending(now, deps)` from `email-dispatcher.ts`:
  1. SELECT `email_deliveries.id` WHERE `status = 'pending'` AND
     (`next_attempt_at IS NULL` OR `next_attempt_at <= now`) LIMIT N.
  2. For each row, hydrate the parent `notification_events`, render
     the email via a per-kind template, call
     `transport.send(message)`.
  3. On success: `status = 'sent'`, `last_attempt_at = now`,
     `attempt_count++`.
  4. On failure: `attempt_count++`, `last_error = err.message`,
     `last_attempt_at = now`, `next_attempt_at = now + backoff(
     attempt_count)`. If `attempt_count >= 5`: `status = 'failed'`
     and log a `EMAIL_DELIVERY_PERMANENT_FAILURE` line with the
     event id.
- Backoff: `30 s, 2 m, 15 m, 1 h, 6 h` (hard-coded in
  `email-dispatcher.ts`, unit-tested).
- Idempotency: the dispatcher uses an `UPDATE … SET status = 'sending'
  WHERE id = ? AND status = 'pending' RETURNING …` lock-take so a
  concurrent tick cannot double-send the same row.

### Positive Consequences

- Domain transactions are decoupled from SMTP availability; a relay
  outage delays mail but does not roll back state changes.
- The transport interface is a strict boundary; every unit test of
  `notification-service` / `email-dispatcher` runs without a network.
- Anonymity is enforced **at enqueue** time when the payload is built
  (calling the existing Phase-4 `maskAuthor`), so the dispatcher
  cannot accidentally leak identity.
- The retry / digest / suppression logic is one cohesive module.

### Negative Consequences

- The 1 s tick adds one query per second to the database when the
  queue is empty. At the spec scale this is negligible; if it ever
  matters, the tick interval is env-configurable.
- A node-process crash mid-`sending` leaves a row stuck in `sending`;
  a recovery sweep (status `sending` + `last_attempt_at` older than
  N minutes → reset to `pending`) is the obvious fix and is added to
  the worker as a startup step.

## Pros and Cons of the Options

- **Option 2** violates NFR-003: SMTP latency directly inflates p95
  on every state change; a transient SMTP outage rolls back the
  domain commit.
- **Option 3** is out of scope per the spec Assumption and the
  user-provided default.
- **Option 4** is operationally heavier than the project warrants and
  introduces Redis as a hard runtime dep.

## Links

- Implements [FR-010..FR-018](../spec.md).
- Reuses anonymity policy from [ADR-0018](../../004-advanced-evaluation-experience/adr/0018-anonymity-model.md).
- Cooperates with [ADR-0026](./0026-in-app-notification-polling.md):
  the same `notification_events` table feeds both mail and the in-app
  badge.
