# TODO — Deferred / Experimental Work

## Experimental Feature 006 — Production-Grade Infrastructure (deferred, **not** merged to `main`)

Scope: replace the demo-friendly SQLite-on-disk + in-process email
poller setup with a production stack. Treat as a research /
experimental branch only; do **not** merge to `main` until the
course-project portion is fully signed off and demoed.

Planned via a full SpecKit cycle on a feature branch
`006-postgres-monitoring-k8s`:

1. `/speckit.specify` — write the feature spec covering:
   - PostgreSQL 16 as the primary datastore (replace better-sqlite3),
     with Drizzle dialect swap + new migrations + Docker Compose
     service.
   - Out-of-process email dispatcher (BullMQ + Redis or pg-boss) so
     `email-dispatcher` runs as a worker, not inside the web
     process.
   - Observability: OpenTelemetry traces, Prometheus metrics,
     structured logs shipped to Loki/Grafana, alerting hooks.
   - Kubernetes manifests / Helm chart for the web + worker +
     Postgres + Redis + monitoring stack.
   - Production-grade transactional email via SES or SendGrid with
     DKIM/SPF, replacing the dev nodemailer SMTP path.

2. `/speckit.plan` — design the migration path:
   - Dual-dialect repository layer (no business-logic change required
     because Drizzle abstracts the dialect).
   - Data migration script SQLite → Postgres for the demo seed.
   - Worker bootstrap separate from `instrumentation.ts`.
   - CI matrix: keep the SQLite suite for fast unit/integration runs;
     add a Postgres integration job behind a service container.

3. `/speckit.tasks` — task breakdown with NFRs:
   - p95 < 200 ms read latency at 100 RPS with Postgres + connection
     pool.
   - Worker can re-process the back-off queue if killed mid-flight.
   - Helm chart deploys cleanly to k3d / kind for local validation.

4. `/speckit.implement` — phase-by-phase, but **do not merge**.
   Leave the experimental branch alive for post-course follow-up.

Why deferred: the course-project rubric scores on completeness of
the InnovatEPAM Portal feature set (001–005), constitutional
compliance, and the SpecKit workflow itself. The production
infrastructure rewrite is a multi-week effort with no rubric uplift,
so it is held back as a stretch goal.

---

## Other follow-ups noticed during 005

- Phase 6 UI for US1 (multi-attachment manager + preview dialog +
  reorder DnD), US2 (notification badge + dropdown + email
  preferences form), and US3 (versions timeline + read-only viewer +
  diff viewer) are tracked as `[!]` in
  `specs/005-attachments-history-notifications/tasks.md` and will be
  picked up in Phase 6.
- T051 in-process notification poller bootstrap from
  `src/instrumentation.ts` is deferred so that integration tests
  call `dispatchPending(now, deps)` directly.
- Regression: a handful of pre-existing integration tests (transitions,
  drafts-lifecycle, ideas-history, ideas-listing/queue, ideas-export)
  now fail because `applyTransition(..., "APPROVE")` requires every
  required rating dimension (`RATING_REQUIRED_MISSING`) — they need to
  seed dimension scores before transitioning. Fix during Phase 6
  polish.
