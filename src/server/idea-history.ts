import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { users, type IdeaStatus, type Role } from "@/db/schema";
import { AppError } from "@/lib/errors/AppError";
import { findIdeaById } from "@/db/repositories/idea-repo";
import { listTransitionsByIdea } from "@/db/repositories/transition-repo";
import { maskHistoryEvent } from "@/server/anonymity";

/**
 * One row in an idea's combined history feed. The lifecycle splits
 * audit rows into two semantic events depending on the
 * `from = to` discriminator (ADR-0015).
 */
export type IdeaHistoryEvent =
  | {
      kind: "SUBMITTED";
      at: string;
      actorId: string;
      actorName: string;
    }
  | {
      kind: "EDITED";
      at: string;
      actorId: string;
      actorName: string;
      comment: string | null;
    }
  | {
      kind: "TRANSITION";
      at: string;
      actorId: string;
      actorName: string;
      from: IdeaStatus;
      to: IdeaStatus;
      comment: string | null;
    };

/**
 * Builds the timeline for one idea. Always includes a synthesised
 * `SUBMITTED` event at the start; everything else is read from
 * `status_transitions` and classified by `from = to`.
 *
 * Authorisation:
 *  - the author always reads their own idea
 *  - reviewers (EVALUATOR) and admins read any idea
 *  - anyone else → AUTH_FORBIDDEN_ROLE
 */
export async function getIdeaHistory(
  ideaId: string,
  actor: { id: string; role: Role },
): Promise<IdeaHistoryEvent[]> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const isAuthor = idea.authorId === actor.id;
  const isPrivileged = actor.role === "EVALUATOR" || actor.role === "ADMIN";
  if (!isAuthor && !isPrivileged) {
    throw new AppError("AUTH_FORBIDDEN_ROLE");
  }

  const transitionRows = await listTransitionsByIdea(ideaId);
  const actorIds = new Set<string>([idea.authorId, ...transitionRows.map((r) => r.actorId)]);
  const userRows = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(inArray(users.id, [...actorIds]));
  const nameById = new Map(userRows.map((u) => [u.id, u.displayName]));

  const submitted: IdeaHistoryEvent = {
    kind: "SUBMITTED",
    at: new Date(idea.createdAt).toISOString(),
    actorId: idea.authorId,
    actorName: nameById.get(idea.authorId) ?? "Unknown",
  };

  const events: IdeaHistoryEvent[] = transitionRows.map((r) => {
    const actorName = nameById.get(r.actorId) ?? "Unknown";
    const at = new Date(r.recordedAt).toISOString();
    if (r.fromState === r.toState) {
      return {
        kind: "EDITED",
        at,
        actorId: r.actorId,
        actorName,
        comment: r.comment ?? null,
      };
    }
    return {
      kind: "TRANSITION",
      at,
      actorId: r.actorId,
      actorName,
      from: r.fromState as IdeaStatus,
      to: r.toState as IdeaStatus,
      comment: r.comment ?? null,
    };
  });

  return [submitted, ...events].map((e) =>
    maskHistoryEvent(e, {
      ideaAnonymous: Boolean((idea as { anonymous?: number | boolean }).anonymous),
      authorId: idea.authorId,
      viewer: actor,
    }),
  );
}
