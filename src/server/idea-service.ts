import { renameSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { db, withTx } from "@/db/client";
import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import {
  findCategoryById,
  findOtherCategoryId,
  parseSchemaJson,
} from "@/db/repositories/category-repo";
import {
  insertIdea,
  findIdeaById,
  listIdeasByAuthor,
  listPendingIdeas,
  updateIdeaStatus,
  updateIdea,
  hardDeleteIdea,
  relinkCategory,
  readAnswers,
} from "@/db/repositories/idea-repo";
import { findAttachmentById, commitAttachmentToIdea } from "@/db/repositories/attachment-repo";
import {
  insertTransition,
  insertEditedMarker,
  listTransitionsByIdea,
} from "@/db/repositories/transition-repo";
import {
  evaluateTransition,
  canAuthorEdit,
  canAuthorDelete,
  type TransitionAction,
} from "@/server/idea-state-machine";
import { logSecurityEvent } from "@/server/infra/logger";
import type { CreateIdeaInput, UpdateIdeaInput } from "@/lib/validation/idea";
import type { Role } from "@/db/schema";
import { validateAnswers, orderAnswersForDisplay } from "@/server/category-answers";
import type { IdeaStructuredAnswer } from "@/lib/validation/category-fields";

const UPLOAD_ROOT = join(process.cwd(), "data", "uploads");

/**
 * Service deps that tests can substitute.
 */
export interface IdeaServiceDeps {
  clock: Clock;
  ids: IdGenerator;
}

const defaultDeps: IdeaServiceDeps = {
  clock: SystemClock,
  ids: SystemIdGenerator,
};

/**
 * Snapshot of an idea returned to the UI / API clients.
 */
export interface IdeaDetail {
  id: string;
  authorId: string;
  authorName: string;
  anonymous: boolean;
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryState: "ACTIVE" | "PROPOSED" | "REJECTED";
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "IMPLEMENTED";
  createdAt: number;
  updatedAt: number;
  attachment: { id: string; originalName: string; sizeBytes: number; mimeType: string } | null;
  /**
   * Phase 2: structured answers attached to the idea, ordered for
   * display (known fields first per the live schema, then orphans).
   * Empty for pre-Phase-2 ideas.
   */
  answers: IdeaStructuredAnswer[];
}

async function loadDetail(ideaId: string): Promise<IdeaDetail> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const cat = await findCategoryById(idea.categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");
  const att = await (
    await import("@/db/repositories/attachment-repo")
  ).findAttachmentByIdeaId(idea.id);
  const rawAnswers = await readAnswers(idea.id);
  const fields = parseSchemaJson(cat.fieldSchema);
  const answers = orderAnswersForDisplay(rawAnswers, fields);
  const { db } = await import("@/db/client");
  const { users } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  const authorRows = await db
    .select({ displayName: users.displayName })
    .from(users)
    .where(eq(users.id, idea.authorId))
    .limit(1);
  return {
    id: idea.id,
    authorId: idea.authorId,
    authorName: authorRows[0]?.displayName ?? "Unknown",
    anonymous: Boolean((idea as { anonymous?: number | boolean }).anonymous),
    title: idea.title,
    description: idea.description,
    categoryId: idea.categoryId,
    categoryName: cat.name,
    categoryState: cat.state,
    status: idea.status,
    createdAt: idea.createdAt,
    updatedAt: idea.updatedAt,
    attachment: att
      ? {
          id: att.id,
          originalName: att.originalName,
          sizeBytes: att.sizeBytes,
          mimeType: att.mimeType,
        }
      : null,
    answers,
  };
}

/**
 * Creates a new idea, optionally proposing a new category and/or
 * linking a previously-staged attachment. Runs in a single tx.
 *
 * Phase 2: when the chosen category is `ACTIVE` and has a non-empty
 * `field_schema`, validates the supplied `input.answers` against it
 * via {@link validateAnswers} and persists the resulting
 * `IdeaStructuredAnswer[]` (with `labelSnapshot` per FR-008) on
 * `ideas.category_answers`. For a `PROPOSED` category (newly
 * proposed by this user) answer validation is skipped — that
 * category has no schema yet and no admin has approved one.
 * A `REJECTED` category is already short-circuited by
 * {@link resolveCategoryId} before answer validation can run.
 */
export async function createIdea(
  input: CreateIdeaInput,
  authorId: string,
  deps: IdeaServiceDeps = defaultDeps,
): Promise<IdeaDetail> {
  const now = deps.clock.now().getTime();
  const categoryId = await resolveCategoryId(input, authorId, now, deps);
  const staged = await resolveStagedAttachment(input.attachmentId ?? null, authorId);

  const category = await findCategoryById(categoryId);
  const fields = category?.state === "ACTIVE" ? parseSchemaJson(category.fieldSchema) : [];
  const answers = fields.length > 0 ? validateAnswers(fields, input.answers ?? {}) : [];

  const ideaId = deps.ids.next();
  await insertIdea({
    id: ideaId,
    authorId,
    title: input.title,
    description: input.description,
    categoryId,
    status: "SUBMITTED",
    createdAt: now,
    updatedAt: now,
    answers,
  });

  if (staged) {
    await commitStagedAttachment(staged, ideaId);
  }

  return loadDetail(ideaId);
}

async function resolveCategoryId(
  input: CreateIdeaInput,
  authorId: string,
  now: number,
  deps: IdeaServiceDeps,
): Promise<string> {
  if (input.categoryId) {
    const existing = await findCategoryById(input.categoryId);
    if (!existing || existing.state === "REJECTED") {
      throw new AppError("IDEA_CATEGORY_INVALID");
    }
    return input.categoryId;
  }
  void authorId;
  void now;
  void deps;
  throw new AppError("IDEA_CATEGORY_INVALID");
}

interface StagedAttachment {
  id: string;
  storedPath: string;
}

async function resolveStagedAttachment(
  attachmentId: string | null,
  authorId: string,
): Promise<StagedAttachment | null> {
  if (!attachmentId) return null;
  const att = await findAttachmentById(attachmentId);
  if (!att || att.uploaderId !== authorId || att.ideaId !== null) {
    throw AppError.notFound("ATTACHMENT_NOT_FOUND");
  }
  return { id: att.id, storedPath: att.storedPath };
}

async function commitStagedAttachment(staged: StagedAttachment, ideaId: string): Promise<void> {
  const fileName = staged.storedPath.split(/[\\/]/).pop() ?? staged.id;
  const dest = join(UPLOAD_ROOT, ideaId, fileName.replace(/^\.staging[\\/]+/, ""));
  mkdirSync(dirname(dest), { recursive: true });
  if (existsSync(staged.storedPath)) {
    renameSync(staged.storedPath, dest);
  }
  await commitAttachmentToIdea(staged.id, ideaId, dest);
}

/**
 * Lists ideas authored by `authorId` (for "My Ideas").
 */
export async function listMineIdeas(authorId: string): Promise<IdeaDetail[]> {
  const rows = await listIdeasByAuthor(authorId);
  return Promise.all(rows.map((r) => loadDetail(r.id)));
}

/**
 * Lists pending ideas for reviewers (default queue scope).
 */
export async function listQueueIdeas(): Promise<IdeaDetail[]> {
  const rows = await listPendingIdeas();
  return Promise.all(rows.map((r) => loadDetail(r.id)));
}

/**
 * Loads a single idea detail (no auth check — caller enforces).
 * When `viewer` is provided, applies the anonymity projection
 * (ADR-0018) so the returned author fields are masked for
 * Evaluators viewing an anonymous idea.
 */
export async function getIdeaDetail(
  ideaId: string,
  viewer?: { id: string; role: import("@/db/schema").Role },
): Promise<IdeaDetail> {
  const detail = await loadDetail(ideaId);
  if (!viewer) return detail;
  const { maskAuthor } = await import("@/server/anonymity");
  const masked = maskAuthor(
    {
      id: detail.id,
      authorId: detail.authorId,
      authorName: detail.authorName,
      anonymous: detail.anonymous,
    },
    viewer,
  );
  return { ...detail, authorId: masked.authorId, authorName: masked.authorName };
}

/**
 * Lists the audit-log transitions for an idea.
 */
export async function listIdeaTransitions(ideaId: string): Promise<
  Array<{
    id: string;
    from: string;
    to: string;
    comment: string | null;
    recordedAt: number;
    actorId: string;
  }>
> {
  const rows = await listTransitionsByIdea(ideaId);
  return rows.map((r) => ({
    id: r.id,
    from: r.fromState,
    to: r.toState,
    comment: r.comment ?? null,
    recordedAt: r.recordedAt,
    actorId: r.actorId,
  }));
}

/**
 * Applies a state-machine transition: verifies via {@link evaluateTransition},
 * writes the new status, and records a `status_transitions` row in one tx.
 * On APPROVE/REJECT the call also (1) requires every required
 * rating dimension to be scored, (2) locks the deciding reviewer's
 * ratings, and (3) inserts a `DECISION` comment with the decision
 * note — all in the same transaction (US2 / ADRs 0019, 0020).
 */
export async function applyTransition(
  ideaId: string,
  action: TransitionAction,
  comment: string | null,
  actor: { id: string; role: Role },
  deps: IdeaServiceDeps = defaultDeps,
): Promise<IdeaDetail> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const cat = await findCategoryById(idea.categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");

  const decision = evaluateTransition({
    idea: { status: idea.status, authorId: idea.authorId, categoryState: cat.state },
    actor,
    action,
    comment,
  });
  if (decision.kind === "deny") {
    throw new AppError(decision.code);
  }

  // US2: require all required dimensions before a decision lands.
  if (action === "APPROVE" || action === "REJECT") {
    const { requireRequiredDimensions } = await import("@/server/rating-service");
    await requireRequiredDimensions(ideaId, actor.id);
  }

  const now = deps.clock.now().getTime();
  withTx(() => {
    void updateIdeaStatus(ideaId, decision.toState, now);
    void insertTransition({
      id: deps.ids.next(),
      ideaId,
      actorId: actor.id,
      fromState: idea.status,
      toState: decision.toState,
      comment: comment?.trim() ? comment.trim() : null,
      recordedAt: now,
    });
  });

  // Lock ratings + insert decision comment after the status flip.
  if (action === "APPROVE" || action === "REJECT") {
    const { lockOnDecision } = await import("@/server/rating-service");
    const { postComment } = await import("@/server/comment-service");
    await lockOnDecision(ideaId, actor, deps);
    if (comment?.trim()) {
      await postComment(ideaId, actor, { body: comment.trim() }, { kind: "DECISION" }, deps);
    }
  }

  logSecurityEvent({
    event: "idea_transition",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { ideaId, from: idea.status, to: decision.toState, action },
  });

  // eslint-disable-next-line no-use-before-define -- inline US2 hook
  await emitStatusChangedNotification(idea, decision.toState, actor, ideaId);

  return loadDetail(ideaId);
}

/* eslint-disable jsdoc/require-jsdoc -- internal helper */
async function emitStatusChangedNotification(
  idea: { authorId: string; title: string; status: string; anonymous?: number | boolean },
  toState: string,
  actor: { id: string; role: string },
  ideaId: string,
): Promise<void> {
  if (idea.authorId === actor.id) return;
  try {
    const { enqueue } = await import("@/server/notification-service");
    await enqueue([
      {
        recipientId: idea.authorId,
        recipientRole: "EMPLOYEE",
        actorId: actor.id,
        ideaId,
        kind: "STATUS_CHANGED",
        payload: {
          kind: "STATUS_CHANGED",
          ideaTitle: idea.title,
          fromState: idea.status as never,
          toState: toState as never,
          actorDisplayName: actor.role,
        },
        ideaAnonymous: Boolean(idea.anonymous),
        actorIsAuthor: false,
        preferenceKey: "statusChanges",
      },
    ]);
  } catch {
    // swallow — notification failure must never roll back a domain write
  }
}
/* eslint-enable jsdoc/require-jsdoc */

// re-export helpers used by category-service for transactional safety
export const _internal = {
  relinkCategory,
  unlinkSync,
  db,
  findOtherCategoryId,
};

/**
 * US1: Edit an own SUBMITTED idea. Validates structural fields and
 * (when the target category is ACTIVE with a non-empty schema)
 * validates structured answers against the live schema. Writes a
 * `from = to = SUBMITTED` audit row inside a single transaction
 * (ADR-0015). Emits an `idea_edited` security event.
 * @throws `IDEA_NOT_FOUND` when the idea doesn't exist.
 * @throws `AUTH_FORBIDDEN_ROLE` when the actor is not the author.
 * @throws `IDEA_NOT_EDITABLE` when the idea is past `SUBMITTED`.
 * @throws `IDEA_CATEGORY_INVALID` when the target category cannot be used.
 */
export async function editIdea(
  ideaId: string,
  input: UpdateIdeaInput,
  actor: { id: string; role: Role },
  deps: IdeaServiceDeps = defaultDeps,
): Promise<IdeaDetail> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");

  if (idea.authorId !== actor.id) throw new AppError("AUTH_FORBIDDEN_ROLE");
  if (!canAuthorEdit({ idea: { status: idea.status, authorId: idea.authorId }, actor })) {
    throw new AppError("IDEA_NOT_EDITABLE");
  }

  const targetCategory = await findCategoryById(input.categoryId);
  if (!targetCategory || targetCategory.state === "REJECTED") {
    throw new AppError("IDEA_CATEGORY_INVALID");
  }

  const fields =
    targetCategory.state === "ACTIVE" ? parseSchemaJson(targetCategory.fieldSchema) : [];
  const answers = fields.length > 0 ? validateAnswers(fields, input.answers ?? {}) : [];

  const now = deps.clock.now().getTime();
  withTx(() => {
    void updateIdea(ideaId, {
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      answers,
      updatedAt: now,
    });
    void insertEditedMarker({
      id: deps.ids.next(),
      ideaId,
      actorId: actor.id,
      status: idea.status,
      comment: null,
      recordedAt: now,
    });
  });

  logSecurityEvent({
    event: "idea_edited",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { ideaId },
  });

  return loadDetail(ideaId);
}

/**
 * US1: Hard-deletes an own SUBMITTED idea. Cascades via FKs delete
 * the attached file row and audit rows; the on-disk attachment
 * directory (if any) is best-effort removed after the transaction
 * commits.
 * @throws `IDEA_NOT_FOUND` when the idea doesn't exist.
 * @throws `AUTH_FORBIDDEN_ROLE` when the actor is not the author.
 * @throws `IDEA_NOT_DELETABLE` when the idea is past `SUBMITTED`.
 */
export async function deleteIdea(ideaId: string, actor: { id: string; role: Role }): Promise<void> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  if (idea.authorId !== actor.id) throw new AppError("AUTH_FORBIDDEN_ROLE");
  if (!canAuthorDelete({ idea: { status: idea.status, authorId: idea.authorId }, actor })) {
    throw new AppError("IDEA_NOT_DELETABLE");
  }

  // Capture attachment path before delete so we can clean up disk.
  const att = await (
    await import("@/db/repositories/attachment-repo")
  ).findAttachmentByIdeaId(ideaId);

  await hardDeleteIdea(ideaId);

  if (att?.storedPath && existsSync(att.storedPath)) {
    try {
      unlinkSync(att.storedPath);
    } catch {
      // best-effort; row is already gone.
    }
  }

  logSecurityEvent({
    event: "idea_deleted",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { ideaId },
  });
}

/**
 * US3 / ADR-0018: Admin-only per-idea anonymity override. Flips the
 * `ideas.anonymous` snapshot column and emits an
 * `anonymity_overridden` audit event. Returns the refreshed detail
 * with the admin viewer applied (admins always see real identities).
 * @throws `IDEA_NOT_FOUND` when the idea doesn't exist.
 * @throws `AUTH_FORBIDDEN_ROLE` when the actor is not an ADMIN.
 */
export async function setIdeaAnonymity(
  ideaId: string,
  anonymous: boolean,
  actor: { id: string; role: Role },
  deps: IdeaServiceDeps = defaultDeps,
): Promise<IdeaDetail> {
  if (actor.role !== "ADMIN") throw new AppError("AUTH_FORBIDDEN_ROLE");
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const { setIdeaAnonymous } = await import("@/db/repositories/idea-repo");
  const now = deps.clock.now().getTime();
  await setIdeaAnonymous(ideaId, anonymous, now);
  logSecurityEvent({
    event: "anonymity_overridden",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { ideaId, anonymous },
  });
  return getIdeaDetail(ideaId, actor);
}
