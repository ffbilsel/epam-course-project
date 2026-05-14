import { db, withTx } from "@/db/client";
import { ideaDrafts, ideas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import {
  createDraft as createDraftRow,
  updateDraft as updateDraftRow,
  getDraft as getDraftRow,
  listDraftsByAuthor,
  deleteDraft as deleteDraftRow,
} from "@/db/repositories/draft-repo";
import { findCategoryById, parseSchemaJson } from "@/db/repositories/category-repo";
import { validateAnswers } from "@/server/category-answers";
import { SaveDraftSchema, SubmitDraftSchema } from "@/lib/validation/draft";
import type { Role } from "@/db/schema";
import { logSecurityEvent } from "@/server/infra/logger";

/** Service-level draft projection (FR-001…FR-006). */
export interface Draft {
  id: string;
  authorId: string;
  title: string;
  description: string;
  categoryId: string | null;
  answers: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

/** Listing summary returned by {@link listMyDrafts}. */
export interface DraftSummary {
  id: string;
  title: string;
  categoryId: string | null;
  updatedAt: number;
}

interface Deps {
  clock?: Clock;
  ids?: IdGenerator;
}

function parseAnswers(raw: string | null | undefined): Record<string, unknown> {
  if (!raw || raw === "[]" || raw === "{}") return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function toDraft(row: typeof ideaDrafts.$inferSelect): Draft {
  return {
    id: row.id,
    authorId: row.authorId,
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    answers: parseAnswers(row.categoryAnswers),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function requireOwnedDraft(
  id: string,
  actorId: string,
): Promise<typeof ideaDrafts.$inferSelect> {
  const row = await getDraftRow(id);
  if (!row) throw AppError.notFound("DRAFT_NOT_FOUND");
  if (row.authorId !== actorId) throw new AppError("DRAFT_FORBIDDEN");
  return row;
}

/**
 * Create-or-update a draft (autosave). If `id` is provided and
 * exists for the caller, the row is patched; otherwise a new row is
 * inserted. The `id` is returned for the client to keep across
 * subsequent autosaves.
 */
/* eslint-disable complexity */
export async function saveDraft(
  input: {
    id?: string | null;
    title?: string;
    description?: string;
    categoryId?: string | null;
    answers?: Record<string, unknown>;
  },
  actor: { id: string },
  deps: Deps = {},
): Promise<Draft> {
  const parsed = SaveDraftSchema.parse({
    title: input.title,
    description: input.description,
    categoryId: input.categoryId,
    answers: input.answers,
  });
  const clock = deps.clock ?? SystemClock;
  const ids = deps.ids ?? SystemIdGenerator;
  const now = clock.now().getTime();

  if (input.id) {
    const existing = await getDraftRow(input.id);
    if (!existing) throw AppError.notFound("DRAFT_NOT_FOUND");
    if (existing.authorId !== actor.id) throw new AppError("DRAFT_FORBIDDEN");
    const next = {
      title: parsed.title ?? existing.title,
      description: parsed.description ?? existing.description,
      categoryId: parsed.categoryId !== undefined ? parsed.categoryId : existing.categoryId,
      categoryAnswers:
        parsed.answers !== undefined ? JSON.stringify(parsed.answers) : existing.categoryAnswers,
      updatedAt: now,
    };
    await updateDraftRow(input.id, next);
    const updated = await getDraftRow(input.id);
    return toDraft(updated!);
  }

  const id = ids.next();
  await createDraftRow({
    id,
    authorId: actor.id,
    title: parsed.title ?? "",
    description: parsed.description ?? "",
    categoryId: parsed.categoryId ?? null,
    categoryAnswers: JSON.stringify(parsed.answers ?? {}),
    createdAt: now,
    updatedAt: now,
  });
  const row = await getDraftRow(id);
  return toDraft(row!);
}
/* eslint-enable complexity */

/** Load one draft (author-only). */
export async function loadDraft(id: string, actor: { id: string }): Promise<Draft> {
  const row = await requireOwnedDraft(id, actor.id);
  return toDraft(row);
}

/** List the caller's drafts, newest first. */
export async function listMyDrafts(actorId: string): Promise<DraftSummary[]> {
  const rows = await listDraftsByAuthor(actorId);
  return rows.map((r) => ({
    id: r.id,
    title: r.title || "(untitled draft)",
    categoryId: r.categoryId,
    updatedAt: r.updatedAt,
  }));
}

/** Hard-delete a draft owned by the caller. */
export async function deleteDraft(id: string, actor: { id: string }): Promise<void> {
  await requireOwnedDraft(id, actor.id);
  await deleteDraftRow(id, actor.id);
}

/**
 * Promote a draft to a submitted Idea. Validates the draft body
 * against {@link SubmitDraftSchema}, then runs feature-002 answer
 * validation, snapshots `categories.anonymous_default` into the new
 * idea, inserts the `ideas` row, and deletes the draft — all in
 * a single transaction (ADR-0017 / ADR-0018).
 */
export async function submitDraft(
  id: string,
  actor: { id: string; role: Role },
  deps: Deps = {},
): Promise<{ ideaId: string }> {
  const row = await requireOwnedDraft(id, actor.id);
  const parsed = SubmitDraftSchema.safeParse({
    title: row.title,
    description: row.description,
    categoryId: row.categoryId,
    answers: parseAnswers(row.categoryAnswers),
  });
  if (!parsed.success) {
    throw new AppError("DRAFT_VALIDATION", { issues: parsed.error.flatten() });
  }

  const category = await findCategoryById(parsed.data.categoryId);
  if (!category || category.state === "REJECTED") {
    throw new AppError("IDEA_CATEGORY_INVALID");
  }
  const fields = category.state === "ACTIVE" ? parseSchemaJson(category.fieldSchema) : [];
  const answers = fields.length > 0 ? validateAnswers(fields, parsed.data.answers ?? {}) : [];

  const ids = deps.ids ?? SystemIdGenerator;
  const clock = deps.clock ?? SystemClock;
  const now = clock.now().getTime();
  const ideaId = ids.next();

  withTx(() => {
    void db.insert(ideas).values({
      id: ideaId,
      authorId: actor.id,
      title: parsed.data.title,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId,
      status: "SUBMITTED",
      createdAt: now,
      updatedAt: now,
      categoryAnswers: JSON.stringify(answers),
      anonymous: category.anonymousDefault ? 1 : 0,
    });
    void db.delete(ideaDrafts).where(eq(ideaDrafts.id, id));
  });

  logSecurityEvent({
    event: "draft_submitted",
    userId: actor.id,
    actorRole: actor.role,
    ip: null,
    requestId: null,
    details: { draftId: id, ideaId },
  });

  return { ideaId };
}
