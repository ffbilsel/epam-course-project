import type { Role } from "@/db/schema";
import type { NotificationPayload } from "@/lib/validation/notification";

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
