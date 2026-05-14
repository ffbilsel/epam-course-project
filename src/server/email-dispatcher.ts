import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  listDueDeliveries,
  updateDelivery,
  findDeliveryById,
} from "@/db/repositories/email-delivery-repo";
import { findNotificationById } from "@/db/repositories/notification-repo";
import type { EmailTransport, OutboundMail } from "@/server/infra/email-transport";
import { logSecurityEvent } from "@/server/infra/logger";
import type { NotificationPayload } from "@/lib/validation/notification";

async function findUserById(
  id: string,
): Promise<{ id: string; email: string } | undefined> {
  const r = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return r[0];
}

/**
 * Phase 5 — Back-off schedule (in seconds) for the email dispatcher
 * per ADR-0023: 30 s, 2 m, 15 m, 1 h, 6 h, then terminal failed.
 */
const BACKOFF_SECONDS = [30, 120, 900, 3600, 21600] as const;
const MAX_ATTEMPTS = 6;

const DEFAULT_FROM = process.env["MAIL_FROM"] ?? "InnovatEPAM <no-reply@innovatepam.test>";

function subjectFor(payload: NotificationPayload): string {
  switch (payload.kind) {
    case "STATUS_CHANGED":
      return `[InnovatEPAM] ${payload.ideaTitle} → ${payload.toState}`;
    case "COMMENT_ADDED":
      return `[InnovatEPAM] New comment on ${payload.ideaTitle}`;
    case "RATING_ADDED":
      return `[InnovatEPAM] New rating on ${payload.ideaTitle}`;
    case "REPLY_ON_REVIEW":
      return `[InnovatEPAM] Reply on ${payload.ideaTitle}`;
    case "BULK_DIGEST":
      return `[InnovatEPAM] ${payload.items.length} idea updates`;
  }
}

function bodyFor(payload: NotificationPayload): { text: string; html: string } {
  if (payload.kind === "STATUS_CHANGED") {
    const t = `${payload.actorDisplayName} moved "${payload.ideaTitle}" from ${payload.fromState} to ${payload.toState}.`;
    return { text: t, html: `<p>${t}</p>` };
  }
  if (payload.kind === "COMMENT_ADDED" || payload.kind === "REPLY_ON_REVIEW") {
    const t = `${payload.actorDisplayName} wrote on "${payload.ideaTitle}":\n\n${payload.snippet}`;
    const h = `<p><strong>${payload.actorDisplayName}</strong> wrote on <em>${payload.ideaTitle}</em>:</p><blockquote>${payload.snippet}</blockquote>`;
    return { text: t, html: h };
  }
  if (payload.kind === "RATING_ADDED") {
    const lines = payload.perDimension.map((d) => `${d.label}: ${d.score ?? "-"}`).join("\n");
    return {
      text: `${payload.actorDisplayName} rated "${payload.ideaTitle}":\n${lines}`,
      html: `<p><strong>${payload.actorDisplayName}</strong> rated <em>${payload.ideaTitle}</em>:</p><ul>${payload.perDimension
        .map((d) => `<li>${d.label}: ${d.score ?? "-"}</li>`)
        .join("")}</ul>`,
    };
  }
  // BULK_DIGEST
  const lines = payload.items.map((i) => `- ${i.ideaTitle}: ${i.fromState} → ${i.toState}`).join("\n");
  return {
    text: `${payload.actorDisplayName} updated ${payload.items.length} ideas:\n${lines}`,
    html: `<p><strong>${payload.actorDisplayName}</strong> updated ${payload.items.length} ideas:</p><ul>${payload.items
      .map((i) => `<li>${i.ideaTitle}: ${i.fromState} → ${i.toState}</li>`)
      .join("")}</ul>`,
  };
}

/**
 * Phase 5 — Dispatch one wave of pending email deliveries. Pure
 * given an injected clock + transport. Each row's status moves
 * `pending → sent` on success, or its `attempt_count` + `next_attempt_at`
 * advance on failure. Terminal `failed` lands at attempt 6.
 */
// eslint-disable-next-line complexity -- linear validation+retry gates per ADR-0023
export async function dispatchPending(
  now: number,
  deps: { transport: EmailTransport },
): Promise<{ sent: number; failed: number; suppressed: number }> {
  const due = await listDueDeliveries(now, MAX_ATTEMPTS);
  let sent = 0;
  let failed = 0;
  let suppressed = 0;

  for (const row of due) {
    const ev = await findNotificationById(row.eventId);
    if (!ev) {
      await updateDelivery(row.id, { status: "failed", lastError: "event-missing" });
      failed += 1;
      continue;
    }
    const recipient = await findUserById(ev.recipientId);
    if (!recipient) {
      await updateDelivery(row.id, { status: "failed", lastError: "recipient-missing" });
      failed += 1;
      continue;
    }
    let payload: NotificationPayload;
    try {
      payload = JSON.parse(ev.payload) as NotificationPayload;
    } catch {
      await updateDelivery(row.id, { status: "failed", lastError: "payload-parse" });
      failed += 1;
      continue;
    }

    const mail: OutboundMail = {
      from: DEFAULT_FROM,
      to: recipient.email,
      subject: subjectFor(payload),
      ...bodyFor(payload),
      headers: { "List-Unsubscribe": "</account/preferences>" },
    };

    try {
      await deps.transport.send(mail);
      await updateDelivery(row.id, {
        status: "sent",
        attemptCount: row.attemptCount + 1,
        lastAttemptAt: now,
        lastError: null,
        nextAttemptAt: null,
      });
      sent += 1;
    } catch (err) {
      const nextAttempt = row.attemptCount + 1;
      const isTerminal = nextAttempt >= MAX_ATTEMPTS;
      const message = err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500);
      const backoff = BACKOFF_SECONDS[Math.min(nextAttempt - 1, BACKOFF_SECONDS.length - 1)] ?? 0;
      await updateDelivery(row.id, {
        status: isTerminal ? "failed" : "pending",
        attemptCount: nextAttempt,
        lastAttemptAt: now,
        lastError: message,
        nextAttemptAt: isTerminal ? null : now + backoff * 1000,
      });
      if (isTerminal) {
        logSecurityEvent({
          event: "email_dispatch_failed_permanent",
          userId: ev.recipientId,
          actorRole: null,
          ip: null,
          requestId: null,
          details: { deliveryId: row.id, lastError: message },
        });
        failed += 1;
      }
    }
  }
  return { sent, failed, suppressed };
}

/** Test helper — read one delivery row by id. */
export async function inspectDelivery(id: string): Promise<unknown> {
  return findDeliveryById(id);
}
