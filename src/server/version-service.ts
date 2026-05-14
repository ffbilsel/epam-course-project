import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { AppError } from "@/lib/errors/AppError";
import {
  findVersion,
  insertVersion,
  listVersionsForIdea,
  nextVersionNo,
} from "@/db/repositories/idea-version-repo";
import { findIdeaById } from "@/db/repositories/idea-repo";
import { listByIdeaOrdered } from "@/db/repositories/attachment-repo";
import type { Role } from "@/db/schema";

async function findUserById(
  id: string,
): Promise<{ id: string; displayName: string | null } | undefined> {
  const r = await db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return r[0];
}

/** One row returned by {@link listVersions}. */
export interface IdeaVersionSummary {
  id: string;
  versionNo: number;
  actorId: string;
  actorDisplayName: string | null;
  createdAt: number;
}

/** Full snapshot returned by {@link getVersion}. */
export interface IdeaVersionDetail extends IdeaVersionSummary {
  title: string;
  description: string;
  categoryId: string | null;
  categoryAnswers: unknown;
  attachmentIds: string[];
}

/** Loose actor shape (mirrors `idea-service`). */
interface Actor {
  id: string;
}

/**
 * Phase 5 — Snapshot v1 for a newly-created idea. Called from
 * `idea-service.createIdea` right after the idea row lands so that
 * the initial structured state is captured (ADR-0024).
 */
export async function snapshotInitial(
  ideaId: string,
  actor: Actor,
  ids: { next(): string },
  now: number,
): Promise<void> {
  await snapshot(ideaId, actor, ids, now, 1);
}

/**
 * Phase 5 — Snapshot v(N+1) after an author edit. Called from
 * `idea-service.editIdea` inside the same logical update.
 */
export async function snapshotEdit(
  ideaId: string,
  actor: Actor,
  ids: { next(): string },
  now: number,
): Promise<void> {
  const versionNo = await nextVersionNo(ideaId);
  await snapshot(ideaId, actor, ids, now, versionNo);
}

async function snapshot(
  ideaId: string,
  actor: Actor,
  ids: { next(): string },
  now: number,
  versionNo: number,
): Promise<void> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const atts = await listByIdeaOrdered(ideaId);
  await insertVersion({
    id: ids.next(),
    ideaId,
    versionNo,
    actorId: actor.id,
    createdAt: now,
    title: idea.title,
    description: idea.description,
    categoryId: idea.categoryId,
    categoryAnswers: idea.categoryAnswers,
    attachmentIds: JSON.stringify(atts.map((a) => a.id)),
  });
}

/**
 * Phase 5 — Auth-checked list of versions for an idea. Mirrors
 * idea detail authorization: author / reviewers / admin only.
 * Unauthorised viewers see `IDEA_NOT_FOUND` so existence is not
 * leaked.
 */
export async function listVersions(
  ideaId: string,
  viewer: { id: string; role: Role },
): Promise<IdeaVersionSummary[]> {
  await assertCanRead(ideaId, viewer);
  const rows = await listVersionsForIdea(ideaId);
  const result: IdeaVersionSummary[] = [];
  for (const r of rows) {
    const user = await findUserById(r.actorId);
    result.push({
      id: r.id,
      versionNo: r.versionNo,
      actorId: r.actorId,
      actorDisplayName: user?.displayName ?? null,
      createdAt: r.createdAt,
    });
  }
  return result;
}

/**
 * Phase 5 — Loads one snapshot by version number with the same
 * authorization rules as {@link listVersions}.
 */
export async function getVersion(
  ideaId: string,
  versionNo: number,
  viewer: { id: string; role: Role },
): Promise<IdeaVersionDetail> {
  await assertCanRead(ideaId, viewer);
  const row = await findVersion(ideaId, versionNo);
  if (!row) throw AppError.notFound("IDEA_VERSION_NOT_FOUND");
  const user = await findUserById(row.actorId);
  return {
    id: row.id,
    versionNo: row.versionNo,
    actorId: row.actorId,
    actorDisplayName: user?.displayName ?? null,
    createdAt: row.createdAt,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    categoryAnswers: safeParse(row.categoryAnswers),
    attachmentIds: safeParseArray(row.attachmentIds),
  };
}

async function assertCanRead(
  ideaId: string,
  viewer: { id: string; role: Role },
): Promise<void> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const canSee =
    viewer.role === "ADMIN" ||
    viewer.role === "EVALUATOR" ||
    idea.authorId === viewer.id;
  if (!canSee) throw AppError.notFound("IDEA_NOT_FOUND");
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function safeParseArray(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
