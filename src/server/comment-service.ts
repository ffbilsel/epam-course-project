import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { inArray } from "drizzle-orm";
import {
  insertComment,
  getComment,
  softDeleteComment,
  editComment as editCommentRow,
  listForIdea,
} from "@/db/repositories/comment-repo";
import { findIdeaById } from "@/db/repositories/idea-repo";
import { CommentEditSchema, CommentPostSchema } from "@/lib/validation/comment";
import { logSecurityEvent } from "@/server/infra/logger";
import type { CommentKind, Role } from "@/db/schema";

const EDIT_WINDOW_MS = 5 * 60 * 1000;

/** One comment node returned to the UI. Replies are nested one level deep. */
export interface CommentNode {
  id: string;
  ideaId: string;
  authorId: string;
  authorName: string;
  authorRoleAtPost: Role;
  parentId: string | null;
  kind: CommentKind;
  body: string;
  createdAt: number;
  editedAt: number | null;
  deletedAt: number | null;
  replies: CommentNode[];
}

interface Deps {
  clock?: Clock;
  ids?: IdGenerator;
}

/**
 * Post a new comment (or one-level reply). Enforces the one-level
 * nesting rule with `COMMENT_NESTING_EXCEEDED`. `kind` is taken
 * from `input.kind` (`COMMENT` by default; `DECISION` is reserved
 * for the idea-service transaction).
 */
export async function postComment(
  ideaId: string,
  actor: { id: string; role: Role },
  input: unknown,
  options: { kind?: CommentKind } = {},
  deps: Deps = {},
): Promise<CommentNode> {
  const parsed = CommentPostSchema.parse(input);
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");

  if (parsed.parentId) {
    const parent = await getComment(parsed.parentId);
    if (!parent || parent.ideaId !== ideaId) {
      throw AppError.notFound("COMMENT_NOT_FOUND");
    }
    if (parent.parentId !== null) {
      throw new AppError("COMMENT_NESTING_EXCEEDED");
    }
  }

  const ids = deps.ids ?? SystemIdGenerator;
  const clock = deps.clock ?? SystemClock;
  const now = clock.now().getTime();
  const id = ids.next();

  await insertComment({
    id,
    ideaId,
    authorId: actor.id,
    authorRoleAtPost: actor.role,
    parentId: parsed.parentId ?? null,
    kind: options.kind ?? "COMMENT",
    body: parsed.body,
    createdAt: now,
  });

  const row = await getComment(id);
  return {
    id,
    ideaId,
    authorId: actor.id,
    authorName: actor.id,
    authorRoleAtPost: actor.role,
    parentId: parsed.parentId ?? null,
    kind: options.kind ?? "COMMENT",
    body: row?.body ?? parsed.body,
    createdAt: now,
    editedAt: null,
    deletedAt: null,
    replies: [],
  };
}

/**
 * Edit a comment within the 5-minute author edit window.
 * `COMMENT_EDIT_WINDOW_EXPIRED` after that.
 */
export async function editComment(
  ideaId: string,
  commentId: string,
  actor: { id: string; role: Role },
  input: unknown,
  deps: Deps = {},
): Promise<void> {
  const parsed = CommentEditSchema.parse(input);
  const row = await getComment(commentId);
  if (!row || row.ideaId !== ideaId) throw AppError.notFound("COMMENT_NOT_FOUND");
  if (row.authorId !== actor.id) throw new AppError("COMMENT_FORBIDDEN");
  const clock = deps.clock ?? SystemClock;
  const now = clock.now().getTime();
  if (now - row.createdAt > EDIT_WINDOW_MS) {
    throw new AppError("COMMENT_EDIT_WINDOW_EXPIRED");
  }
  if (row.deletedAt !== null) throw new AppError("COMMENT_FORBIDDEN");
  await editCommentRow(commentId, parsed.body, now);
}

/**
 * Soft-delete a comment. Author may delete their own; an EVALUATOR
 * or ADMIN may moderate. Moderator deletes emit a
 * `comment_moderated` audit event.
 */
export async function deleteComment(
  ideaId: string,
  commentId: string,
  actor: { id: string; role: Role },
  deps: Deps = {},
): Promise<void> {
  const row = await getComment(commentId);
  if (!row || row.ideaId !== ideaId) throw AppError.notFound("COMMENT_NOT_FOUND");
  const isAuthor = row.authorId === actor.id;
  const isModerator = actor.role === "EVALUATOR" || actor.role === "ADMIN";
  if (!isAuthor && !isModerator) throw new AppError("COMMENT_FORBIDDEN");
  const clock = deps.clock ?? SystemClock;
  const now = clock.now().getTime();
  await softDeleteComment(commentId, actor.id, now);
  if (!isAuthor) {
    logSecurityEvent({
      event: "comment_moderated",
      userId: actor.id,
      actorRole: actor.role,
      ip: null,
      requestId: null,
      details: { ideaId, commentId },
    });
  }
}

/**
 * List every comment for one idea as a one-level thread. Author
 * display names are resolved in one query. When `viewer` is
 * provided, applies the anonymity projection (ADR-0018) to comments
 * authored by the idea's submitter for Evaluator viewers.
 */
export async function listThread(
  ideaId: string,
  viewer?: { id: string; role: Role },
): Promise<CommentNode[]> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const rows = await listForIdea(ideaId);
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const userRows = authorIds.length
    ? await db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(inArray(users.id, authorIds))
    : [];
  const nameById = new Map(userRows.map((u) => [u.id, u.displayName]));

  const byId = new Map<string, CommentNode>();
  const top: CommentNode[] = [];
  const ideaAnonymous = Boolean((idea as { anonymous?: number | boolean }).anonymous);
  const shouldMaskSubmitter =
    ideaAnonymous && viewer?.role === "EVALUATOR" && viewer.id !== idea.authorId;
  for (const r of rows) {
    const isSubmitter = r.authorId === idea.authorId;
    const mask = shouldMaskSubmitter && isSubmitter;
    const node: CommentNode = {
      id: r.id,
      ideaId: r.ideaId,
      authorId: mask ? "" : r.authorId,
      authorName: mask ? "Anonymous Submitter" : (nameById.get(r.authorId) ?? "Unknown"),
      authorRoleAtPost: r.authorRoleAtPost,
      parentId: r.parentId,
      kind: r.kind,
      body: r.body,
      createdAt: r.createdAt,
      editedAt: r.editedAt,
      deletedAt: r.deletedAt,
      replies: [],
    };
    byId.set(r.id, node);
    if (r.parentId === null) {
      top.push(node);
    } else {
      const parent = byId.get(r.parentId);
      if (parent) parent.replies.push(node);
      else top.push(node);
    }
  }
  return top;
}
