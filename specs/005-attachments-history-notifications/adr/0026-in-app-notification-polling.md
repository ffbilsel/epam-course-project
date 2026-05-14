# ADR-0026: In-app notification badge polls every 60 s with a visibility-pause; no SSE / WebSocket / push

- **Status**: Accepted
- **Date**: 2026-05-14
- **Deciders**: Phase-5 design
- **Consulted**: Phase-4 `AppShell` mount point, NFR-002 / SC-002
- **Informed**: spec FR-015 (in-app badge), FR-013 (anonymity in
  payload)

## Context and Problem Statement

Phase 5 introduces an in-app notification badge mirroring the email
events. We must decide **how the client learns about new events**:
poll, SSE, WebSocket, or push.

## Decision Drivers

- The spec Assumption explicitly forbids push notifications and
  mobile out-of-band channels.
- The portal is small (≤ 1 000 active users) and runs SQLite on a
  single Next.js instance — a stable long-lived connection model
  carries operational complexity disproportionate to the gain.
- The acceptable latency for in-app badge updates is on the order of
  a minute, not seconds (the email channel already covers the "right
  now" case).
- The badge must respect anonymity exactly like the email payload
  (FR-013).

## Considered Options

1. **HTTP polling every 60 s via a `useNotifications()` hook in the
   shared `AppShell`, paused while the tab is hidden** (Decision).
2. Server-Sent Events from `/api/notifications/stream`.
3. WebSocket via a separate process behind a reverse proxy.
4. Web Push (service-worker driven).

## Decision Outcome

Chosen option: **#1**.

- `src/lib/hooks/use-notifications.ts` is mounted by `AppShell` once
  per session.
- It calls `GET /api/notifications?since=<lastSeenIso>` every 60 s
  while `document.visibilityState === 'visible'`.
- It pauses the timer on `visibilitychange` and fires one
  catch-up fetch when the tab is foregrounded again.
- The endpoint returns `{ unreadCount, items }` where `items` is the
  10 most-recent events (with anonymity already applied at enqueue
  time — see ADR-0023). The `unreadCount` is a single indexed
  `SELECT COUNT(*) … WHERE recipient_id = ? AND read_at IS NULL`
  hitting `idx_notifications_recipient_unread` (partial index).
- The dropdown is server-rendered from `items` on demand; clicking
  an entry POSTs to `/api/notifications/[id]/read` (idempotent) and
  navigates to the deep link.
- E2E tests override the interval to 250 ms via
  `NOTIFICATION_POLL_INTERVAL_MS` so a spec doesn't sleep 60 s.

### Positive Consequences

- One indexed query per active user per minute. At 1 000 users that
  is ~17 QPS at peak — well inside SQLite's single-writer envelope.
- No long-lived connections; the dev workflow remains hot-reload
  friendly under Next.js App Router.
- Mobile-friendly: pausing on `visibilitychange` keeps idle drain at
  zero.
- The same `notification_events` row powers mail (ADR-0023) and the
  badge — one source of truth, one anonymity gate.

### Negative Consequences

- Up to a 60 s delay between event and badge increment. Acceptable —
  the email channel covers the "right now" UX; the badge is a
  cross-session indicator, not a real-time chat.
- A user who keeps a single tab open for hours pays a small
  background-fetch cost. Mitigated by the visibility pause.

## Pros and Cons of the Options

- **Option 2** needs a long-lived response in a Next.js App Router
  handler; not impossible, but the deployment story (proxy
  buffering, hot-reload semantics) is fragile.
- **Option 3** doubles the runtime (a separate process plus the
  Next.js app), adds an authentication bridge, and is overkill for
  the latency target.
- **Option 4** is explicitly out of scope per spec Assumption.

## Links

- Implements [FR-015](../spec.md) and cooperates with
  [ADR-0023](./0023-nodemailer-smtp-transport.md).
- Reuses the anonymity projection from
  [ADR-0018](../../004-advanced-evaluation-experience/adr/0018-anonymity-model.md).
