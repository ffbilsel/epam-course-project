import { renameSync, mkdirSync, existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { db, withTx } from "@/db/client";
import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import {
  findCategoryById,
  findCategoryByLowerName,
  insertProposedCategory,
  findOtherCategoryId,
} from "@/db/repositories/category-repo";
import {
  insertIdea,
  findIdeaById,
  listIdeasByAuthor,
  listPendingIdeas,
  updateIdeaStatus,
  relinkCategory,
} from "@/db/repositories/idea-repo";
import { findAttachmentById, commitAttachmentToIdea } from "@/db/repositories/attachment-repo";
import { insertTransition, listTransitionsByIdea } from "@/db/repositories/transition-repo";
import { evaluateTransition, type TransitionAction } from "@/server/idea-state-machine";
import { logSecurityEvent } from "@/server/infra/logger";
import type { CreateIdeaInput } from "@/lib/validation/idea";
import type { Role } from "@/db/schema";

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
  title: string;
  description: string;
  categoryId: string;
  categoryName: string;
  categoryState: "ACTIVE" | "PROPOSED" | "REJECTED";
  status: "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "IMPLEMENTED";
  createdAt: number;
  updatedAt: number;
  attachment: { id: string; originalName: string; sizeBytes: number; mimeType: string } | null;
}

async function loadDetail(ideaId: string): Promise<IdeaDetail> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const cat = await findCategoryById(idea.categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");
  const att = await (
    await import("@/db/repositories/attachment-repo")
  ).findAttachmentByIdeaId(idea.id);
  return {
    id: idea.id,
    authorId: idea.authorId,
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
  };
}

/**
 * Creates a new idea, optionally proposing a new category and/or
 * linking a previously-staged attachment. Runs in a single tx.
 */
export async function createIdea(
  input: CreateIdeaInput,
  authorId: string,
  deps: IdeaServiceDeps = defaultDeps,
): Promise<IdeaDetail> {
  const now = deps.clock.now().getTime();
  const categoryId = await resolveCategoryId(input, authorId, now, deps);
  const staged = await resolveStagedAttachment(input.attachmentId ?? null, authorId);

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
  if (input.proposedCategoryName) {
    const dup = await findCategoryByLowerName(input.proposedCategoryName);
    if (dup) throw AppError.conflict("CATEGORY_NAME_TAKEN");
    const id = deps.ids.next();
    await insertProposedCategory({
      id,
      name: input.proposedCategoryName,
      state: "PROPOSED",
      proposedById: authorId,
      decidedById: null,
      decidedAt: null,
      createdAt: now,
      isProtected: 0,
    });
    return id;
  }
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
 */
export async function getIdeaDetail(ideaId: string): Promise<IdeaDetail> {
  return loadDetail(ideaId);
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

  logSecurityEvent({
    event: "idea_transition",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { ideaId, from: idea.status, to: decision.toState, action },
  });

  return loadDetail(ideaId);
}

// re-export helpers used by category-service for transactional safety
export const _internal = {
  relinkCategory,
  unlinkSync,
  db,
  findOtherCategoryId,
};
