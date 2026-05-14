import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import { logSecurityEvent } from "@/server/infra/logger";
import {
  insertNotification,
  listRecentForUser,
  countUnreadForUser,
  markRead as markReadRepo,
  findNotificationById,
} from "@/db/repositories/notification-repo";
import { insertDelivery } from "@/db/repositories/email-delivery-repo";
import { redactPayloadForRecipient } from "@/server/anonymity";
import { getPreferences } from "@/server/email-preference-service";
import type { NotificationKind, NotificationPayload } from "@/lib/validation/notification";
import type { Role } from "@/db/schema";
import { AppError } from "@/lib/errors/AppError";

/**
 * Phase 5 — Input to {@link enqueue} representing a single recipient
 * and the unredacted payload the fan-out will produce. Anonymity
 * redaction is applied here at write time.
 */
export interface NotificationEnqueueInput {
  recipientId: string;
  recipientRole: Role;
  actorId: string | null;
  ideaId: string | null;
  kind: NotificationKind;
  payload: NotificationPayload;
  ideaAnonymous: boolean;
  actorIsAuthor: boolean;
  /**
   * Which preference toggle gates the email side-effect. `null`
   * means "always send" (currently unused — every kind has a gate).
   */
  preferenceKey:
    | "statusChanges"
    | "commentsOnMyIdeas"
    | "ratingsOnMyIdeas"
    | "repliesOnIdeasIReview"
    | null;
}

/**
 * Phase 5 — Persists one in-app notification per input plus an
 * `email_deliveries` row when the recipient's preference is on
 * (FR-014..015). Anonymity is applied at write time so the row's
 * `payload` JSON never contains an identity the recipient shouldn't
 * see (ADR-0018).
 */
export async function enqueue(
  events: NotificationEnqueueInput[],
  deps: { clock?: Clock; ids?: IdGenerator } = {},
): Promise<void> {
  const clock = deps.clock ?? SystemClock;
  const ids = deps.ids ?? SystemIdGenerator;
  for (const ev of events) {
    const payload = redactPayloadForRecipient(
      {
        kind: ev.kind,
        payload: ev.payload,
        ideaAnonymous: ev.ideaAnonymous,
        actorIsAuthor: ev.actorIsAuthor,
      },
      ev.recipientRole,
    );
    const id = ids.next();
    const now = clock.now().getTime();
    await insertNotification({
      id,
      recipientId: ev.recipientId,
      actorId: ev.actorId,
      ideaId: ev.ideaId,
      kind: ev.kind,
      payload: JSON.stringify(payload),
      createdAt: now,
      readAt: null,
    });
    logSecurityEvent({
      event: "notification_enqueued",
      userId: ev.recipientId,
      actorRole: ev.recipientRole,
      ip: null,
      requestId: null,
      details: { kind: ev.kind, ideaId: ev.ideaId, notificationId: id },
    });

    // Side-effect: email delivery, gated by preference.
    if (ev.preferenceKey) {
      const prefs = await getPreferences(ev.recipientId);
      const shouldEmail = prefs[ev.preferenceKey];
      await insertDelivery({
        id: ids.next(),
        eventId: id,
        status: shouldEmail ? "pending" : "suppressed",
        attemptCount: 0,
        lastError: null,
        lastAttemptAt: null,
        nextAttemptAt: shouldEmail ? now : null,
        createdAt: now,
      });
    }
  }
}

/** Phase 5 — In-app notification list payload shape. */
export interface NotificationListResult {
  unreadCount: number;
  items: Array<{
    id: string;
    kind: NotificationKind;
    ideaId: string | null;
    payload: NotificationPayload;
    createdAt: string;
    readAt: string | null;
  }>;
}

/** Lists recent notifications for a user plus unread count. */
export async function listForUser(userId: string): Promise<NotificationListResult> {
  const [rows, unreadCount] = await Promise.all([
    listRecentForUser(userId, 50),
    countUnreadForUser(userId),
  ]);
  return {
    unreadCount,
    items: rows.map((r) => ({
      id: r.id,
      kind: r.kind as NotificationKind,
      ideaId: r.ideaId,
      payload: JSON.parse(r.payload) as NotificationPayload,
      createdAt: new Date(r.createdAt).toISOString(),
      readAt: r.readAt ? new Date(r.readAt).toISOString() : null,
    })),
  };
}

/**
 * Marks a notification as read (idempotent). Throws
 * `NOTIFICATION_NOT_FOUND` when the id is unknown,
 * `NOTIFICATION_FORBIDDEN` when the caller is not the recipient.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
  deps: { clock?: Clock } = {},
): Promise<void> {
  const row = await findNotificationById(notificationId);
  if (!row) throw AppError.notFound("NOTIFICATION_NOT_FOUND");
  if (row.recipientId !== userId) throw new AppError("NOTIFICATION_FORBIDDEN");
  const clock = deps.clock ?? SystemClock;
  await markReadRepo(notificationId, userId, clock.now().getTime());
}
