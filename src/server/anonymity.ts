import type { Role } from "@/db/schema";
import type { NotificationKind, NotificationPayload } from "@/lib/validation/notification";

/**
 * Generic shape consumed by {@link maskAuthor}. Phase 4 idea-listing
 * and detail projections all expose at least these fields.
 */
export interface IdeaLikeWithAuthor {
  id: string;
  authorId: string;
  authorName: string;
  authorEmail?: string | null;
  authorAvatarUrl?: string | null;
  anonymous: boolean;
}

/** Viewer used by {@link maskAuthor}. */
export interface AnonymityViewer {
  id: string;
  role: Role;
}

/** Sentinel display name used for masked submitters. */
export const ANONYMOUS_SUBMITTER_LABEL = "Anonymous Submitter";

/**
 * Anonymity projection (ADR-0018) — a pure, side-effect-free
 * transform that returns a *new* idea-shaped object with the author
 * fields masked iff the viewer should not see them.
 *
 * Rules:
 * - Admins and the author themself always see the real submitter.
 * - Evaluators see the real submitter unless `idea.anonymous` is
 *   true, in which case the author fields are replaced with the
 *   `ANONYMOUS_SUBMITTER_LABEL` and identifying ids/urls are
 *   nullified.
 * - Employees never read other authors' rows in the first place;
 *   when they read their own, they are the author so no masking
 *   applies.
 * @example
 *   maskAuthor(
 *     { id: '1', authorId: 'a', authorName: 'Ada', anonymous: true },
 *     { id: 'b', role: 'EVALUATOR' },
 *   ).authorName === 'Anonymous Submitter';
 */
export function maskAuthor<T extends IdeaLikeWithAuthor>(idea: T, viewer: AnonymityViewer): T {
  const hide = idea.anonymous && viewer.role === "EVALUATOR" && viewer.id !== idea.authorId;
  if (!hide) return idea;
  return {
    ...idea,
    authorId: "",
    authorName: ANONYMOUS_SUBMITTER_LABEL,
    authorEmail: null,
    authorAvatarUrl: null,
  };
}

/**
 * Lifecycle event shape understood by {@link maskHistoryEvent}.
 */
export interface HistoryEventLike {
  kind: string;
  actorId: string;
  actorName: string;
}

/**
 * Mask a history event when (a) the event represents an act by the
 * submitter (`SUBMITTED` or `EDITED`) and (b) the viewing evaluator
 * is not the author and the idea is anonymous.
 */
export function maskHistoryEvent<T extends HistoryEventLike>(
  event: T,
  ctx: { ideaAnonymous: boolean; authorId: string; viewer: AnonymityViewer },
): T {
  const isAuthorAction = event.kind === "SUBMITTED" || event.kind === "EDITED";
  if (!isAuthorAction) return event;
  if (event.actorId !== ctx.authorId) return event;
  const hide =
    ctx.ideaAnonymous && ctx.viewer.role === "EVALUATOR" && ctx.viewer.id !== ctx.authorId;
  if (!hide) return event;
  return { ...event, actorId: "", actorName: ANONYMOUS_SUBMITTER_LABEL };
}

/**
 * Phase 5 — Notification event being enqueued. The `actorIsAuthor`
 * flag tells us whether the event actor (status changer / commenter
 * / etc.) is the idea author — which is the only case anonymity can
 * possibly hide for a reviewer recipient.
 */
export interface RedactableNotificationEvent {
  kind: NotificationKind;
  payload: NotificationPayload;
  ideaAnonymous: boolean;
  actorIsAuthor: boolean;
}

/**
 * Phase 5 — Pure function that returns a copy of `event.payload`
 * with `actorDisplayName` replaced by {@link ANONYMOUS_SUBMITTER_LABEL}
 * when the recipient is an Evaluator AND the event was authored by
 * the idea's submitter AND the idea is anonymous (ADR-0018). Other
 * payload fields are returned verbatim. `BULK_DIGEST` payloads are
 * never redacted (admin actor is never the submitter).
 * @example
 *   redactPayloadForRecipient(
 *     { kind: 'COMMENT_ADDED', payload: {
 *         kind: 'COMMENT_ADDED', ideaTitle: 'X', snippet: 'hi',
 *         actorDisplayName: 'Ada' },
 *       ideaAnonymous: true, actorIsAuthor: true },
 *     'EVALUATOR',
 *   ).actorDisplayName === 'Anonymous Submitter';
 */
export function redactPayloadForRecipient(
  event: RedactableNotificationEvent,
  recipientRole: Role,
): NotificationPayload {
  const hide =
    event.ideaAnonymous && event.actorIsAuthor && recipientRole === "EVALUATOR";
  if (!hide) return event.payload;
  if (event.payload.kind === "BULK_DIGEST") return event.payload;
  return { ...event.payload, actorDisplayName: ANONYMOUS_SUBMITTER_LABEL };
}
