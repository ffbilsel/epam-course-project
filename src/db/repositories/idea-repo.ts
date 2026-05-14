import { and, asc, desc, eq, gte, inArray, like, lte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { categories, ideas, users, type IdeaStatus } from "@/db/schema";
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

/**
 * Sets the `anonymous` flag on an idea (Admin-only override,
 * US3 / ADR-0018).
 */
export async function setIdeaAnonymous(id: string, anonymous: boolean, now: number): Promise<void> {
  await db
    .update(ideas)
    .set({ anonymous: anonymous ? 1 : 0, updatedAt: now })
    .where(eq(ideas.id, id));
}

/**
 * Listing predicate shared by `listFiltered`, `countFiltered`, and
 * the streaming CSV export (Phase 3 / US2).
 *
 * `authorScope` restricts to a specific author (used by `scope=mine`).
 * `statusWhitelist` further restricts the allowed statuses (used by
 * `scope=queue` which the service layer narrows to SUBMITTED +
 * UNDER_REVIEW).
 */
export interface ListingPredicate {
  q?: string;
  categoryId?: string;
  status?: readonly IdeaStatus[];
  /** ISO-8601 yyyy-mm-dd (inclusive lower bound on createdAt). */
  from?: string;
  /** ISO-8601 yyyy-mm-dd (inclusive upper bound on createdAt). */
  to?: string;
  authorScope?: string;
  statusWhitelist?: readonly IdeaStatus[];
}

/**
 * Shape of one row returned by `listFiltered` — joined with the
 * author display name and category name so the wire payload can be
 * built without an N+1 fetch.
 */
export interface IdeaListingRow {
  id: string;
  title: string;
  status: IdeaStatus;
  categoryId: string;
  categoryName: string;
  authorId: string;
  authorName: string;
  anonymous: boolean;
  createdAt: number;
  updatedAt: number;
}

// eslint-disable-next-line complexity -- one branch per optional filter dimension
function buildPredicate(filter: ListingPredicate) {
  const conds = [] as Array<ReturnType<typeof eq>>;
  if (filter.authorScope) conds.push(eq(ideas.authorId, filter.authorScope));
  const allowedStatuses = filter.statusWhitelist
    ? filter.status
      ? filter.status.filter((s) => filter.statusWhitelist!.includes(s))
      : filter.statusWhitelist
    : filter.status;
  if (allowedStatuses && allowedStatuses.length > 0) {
    conds.push(inArray(ideas.status, allowedStatuses as IdeaStatus[]));
  }
  if (filter.categoryId) conds.push(eq(ideas.categoryId, filter.categoryId));
  if (filter.q && filter.q.length > 0) {
    const needle = `%${filter.q.toLowerCase()}%`;
    conds.push(
      or(
        sql`lower(${ideas.title}) LIKE ${needle}`,
        sql`lower(${ideas.description}) LIKE ${needle}`,
      ) as ReturnType<typeof eq>,
    );
  }
  if (filter.from) {
    const fromTs = Date.UTC(
      Number(filter.from.slice(0, 4)),
      Number(filter.from.slice(5, 7)) - 1,
      Number(filter.from.slice(8, 10)),
    );
    conds.push(gte(ideas.createdAt, fromTs));
  }
  if (filter.to) {
    // inclusive upper bound: end-of-day UTC of the `to` date.
    const toTs = Date.UTC(
      Number(filter.to.slice(0, 4)),
      Number(filter.to.slice(5, 7)) - 1,
      Number(filter.to.slice(8, 10)),
      23,
      59,
      59,
      999,
    );
    conds.push(lte(ideas.createdAt, toTs));
  }
  return conds.length === 0 ? undefined : and(...conds);
}

/**
 * Lists ideas matching the given predicate, joined with author and
 * category names, ordered newest-first with a stable id tiebreaker,
 * and paginated (`offset` + `limit`).
 */
export async function listFiltered(
  filter: ListingPredicate,
  offset: number,
  limit: number,
): Promise<IdeaListingRow[]> {
  const where = buildPredicate(filter);
  const rows = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      status: ideas.status,
      categoryId: ideas.categoryId,
      categoryName: categories.name,
      authorId: ideas.authorId,
      authorName: users.displayName,
      anonymous: ideas.anonymous,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
    })
    .from(ideas)
    .innerJoin(categories, eq(ideas.categoryId, categories.id))
    .innerJoin(users, eq(ideas.authorId, users.id))
    .where(where)
    .orderBy(desc(ideas.createdAt), asc(ideas.id))
    .limit(limit)
    .offset(offset);
  return rows.map((r) => ({ ...r, anonymous: Boolean(r.anonymous) })) as IdeaListingRow[];
}

/**
 * Counts ideas matching the predicate (without the join). Used to
 * derive `total` and `totalPages` for the listing API.
 */
export async function countFiltered(filter: ListingPredicate): Promise<number> {
  const where = buildPredicate(filter);
  const r = await db
    .select({ n: sql<number>`count(*)` })
    .from(ideas)
    .where(where);
  return r[0]?.n ?? 0;
}
