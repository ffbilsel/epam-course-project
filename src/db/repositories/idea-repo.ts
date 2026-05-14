import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ideas, type IdeaStatus } from "@/db/schema";
import {
  IdeaCategoryAnswersList,
  type IdeaStructuredAnswer,
} from "@/lib/validation/category-fields";
import { AppError } from "@/lib/errors/AppError";

/**
 * Inserts a new Idea row. Accepts an already-validated structured
 * answer list (see `validateAnswers`) and serialises it to JSON.
 */
export async function insertIdea(
  row: Omit<typeof ideas.$inferInsert, "categoryAnswers"> & {
    answers?: readonly IdeaStructuredAnswer[];
  },
): Promise<void> {
  const { answers, ...rest } = row;
  await db.insert(ideas).values({
    ...rest,
    categoryAnswers: JSON.stringify(answers ?? []),
  });
}

/**
 * Finds an idea by id, or returns undefined.
 */
export async function findIdeaById(id: string): Promise<typeof ideas.$inferSelect | undefined> {
  const r = await db.select().from(ideas).where(eq(ideas.id, id)).limit(1);
  return r[0];
}

/**
 * Lists ideas authored by the given user, newest update first.
 */
export async function listIdeasByAuthor(
  authorId: string,
): Promise<Array<typeof ideas.$inferSelect>> {
  return db.select().from(ideas).where(eq(ideas.authorId, authorId)).orderBy(desc(ideas.updatedAt));
}

/**
 * Lists pending ideas for the reviewer queue.
 */
export async function listPendingIdeas(): Promise<Array<typeof ideas.$inferSelect>> {
  return db
    .select()
    .from(ideas)
    .where(eq(ideas.status, "SUBMITTED" as IdeaStatus))
    .orderBy(asc(ideas.createdAt));
}

/**
 * Updates the status (and updatedAt) of an idea.
 */
export async function updateIdeaStatus(
  id: string,
  status: IdeaStatus,
  updatedAt: number,
): Promise<void> {
  await db.update(ideas).set({ status, updatedAt }).where(eq(ideas.id, id));
}

/**
 * Re-links every idea on `fromCategoryId` to `toCategoryId`. Used when
 * a proposed category is rejected (FR-016).
 */
export async function relinkCategory(
  fromCategoryId: string,
  toCategoryId: string,
  updatedAt: number,
): Promise<void> {
  await db
    .update(ideas)
    .set({ categoryId: toCategoryId, updatedAt })
    .where(and(eq(ideas.categoryId, fromCategoryId)));
}

/**
 * Reads the structured answers attached to an idea, parsed and
 * validated via the at-rest Zod list schema. Returns `[]` for
 * pre-Phase-2 rows that still store `'[]'`.
 */
export async function readAnswers(id: string): Promise<IdeaStructuredAnswer[]> {
  const r = await db
    .select({ categoryAnswers: ideas.categoryAnswers })
    .from(ideas)
    .where(eq(ideas.id, id))
    .limit(1);
  const row = r[0];
  if (!row) throw AppError.notFound("IDEA_NOT_FOUND");
  return parseAnswersJson(row.categoryAnswers);
}

/**
 * Parses raw JSON from `ideas.category_answers`. Silent-degrades
 * empty payloads; throws `IDEA_ANSWER_INVALID` on a corrupt payload.
 */
export function parseAnswersJson(raw: string | null | undefined): IdeaStructuredAnswer[] {
  if (!raw || raw === "[]") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError("IDEA_ANSWER_INVALID");
  }
  const result = IdeaCategoryAnswersList.safeParse(parsed);
  if (!result.success) {
    throw new AppError("IDEA_ANSWER_INVALID");
  }
  return result.data;
}

/**
 * Updates the editable structural fields of an idea (Phase 3 / US1).
 * Caller is responsible for verifying `canAuthorEdit` and for
 * validating answers against the current category schema.
 */
export async function updateIdea(
  id: string,
  fields: {
    title: string;
    description: string;
    categoryId: string;
    answers: readonly IdeaStructuredAnswer[];
    updatedAt: number;
  },
): Promise<void> {
  await db
    .update(ideas)
    .set({
      title: fields.title,
      description: fields.description,
      categoryId: fields.categoryId,
      categoryAnswers: JSON.stringify(fields.answers),
      updatedAt: fields.updatedAt,
    })
    .where(eq(ideas.id, id));
}

/**
 * Hard-deletes an idea. Cascades via FKs delete the row's answers
 * (stored on the same row), attachments, and status_transitions.
 */
export async function hardDeleteIdea(id: string): Promise<void> {
  await db.delete(ideas).where(eq(ideas.id, id));
}
