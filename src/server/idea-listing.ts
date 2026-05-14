import { AppError } from "@/lib/errors/AppError";
import {
  countFiltered,
  listFiltered,
  type IdeaListingRow,
  type ListingPredicate,
} from "@/db/repositories/idea-repo";
import type { ListingQuery, ListingPageSize } from "@/lib/validation/idea";
import type { Role } from "@/db/schema";
import { maskAuthor } from "@/server/anonymity";

/**
 * The narrow projection sent to listing UIs. ISO date strings keep
 * the wire payload stable across timezones.
 */
export interface IdeaSummary {
  id: string;
  title: string;
  status: IdeaListingRow["status"];
  categoryId: string;
  categoryName: string;
  authorId: string;
  authorName: string;
  anonymous: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Generic paginated envelope. */
export interface ListingPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: ListingPageSize;
  totalPages: number;
}

/**
 * Resolves a {@link ListingQuery} into the repository
 * {@link ListingPredicate}, applying the role/scope rules from
 * `specs/003-idea-listing-management/data-model.md` §1:
 *
 * | scope  | allowed roles               | implicit filter                                |
 * | ------ | --------------------------- | ---------------------------------------------- |
 * | mine   | EMPLOYEE, EVALUATOR, ADMIN | `authorId = session.userId`                    |
 * | queue  | EVALUATOR, ADMIN           | `status IN (SUBMITTED, UNDER_REVIEW)`          |
 * | all    | ADMIN                       | none                                           |
 * @throws AUTH_FORBIDDEN_ROLE when the role isn't allowed for the scope.
 */
// eslint-disable-next-line complexity -- linear scope guards + one branch per optional listing filter
export function buildListingPredicate(
  query: ListingQuery,
  session: { id: string; role: Role },
): ListingPredicate {
  if (query.scope === "all" && session.role !== "ADMIN") {
    throw new AppError("AUTH_FORBIDDEN_ROLE");
  }
  if (query.scope === "queue" && session.role === "EMPLOYEE") {
    throw new AppError("AUTH_FORBIDDEN_ROLE");
  }
  const base: ListingPredicate = {};
  if (query.q) base.q = query.q;
  if (query.categoryId) base.categoryId = query.categoryId;
  if (query.status) base.status = query.status as NonNullable<ListingPredicate["status"]>;
  if (query.from) base.from = query.from;
  if (query.to) base.to = query.to;
  if (query.scope === "mine") {
    return { ...base, authorScope: session.id };
  }
  if (query.scope === "queue") {
    return { ...base, statusWhitelist: ["SUBMITTED", "UNDER_REVIEW"] };
  }
  return base;
}

/**
 * Executes a listing query and returns a paginated
 * {@link ListingPage} of {@link IdeaSummary} rows. Out-of-range
 * pages are clamped to the last available page; callers should set
 * `Cache-Control: no-store` when the requested `page` differs from
 * the returned `page` (FR-021).
 */
export async function runListingQuery(
  query: ListingQuery,
  session: { id: string; role: Role },
): Promise<ListingPage<IdeaSummary>> {
  const predicate = buildListingPredicate(query, session);
  const total = await countFiltered(predicate);
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const offset = (page - 1) * query.pageSize;
  const rows = await listFiltered(predicate, offset, query.pageSize);
  return {
    rows: rows.map((r) => toSummary(r, session)),
    total,
    page,
    pageSize: query.pageSize as ListingPageSize,
    totalPages,
  };
}

function toSummary(r: IdeaListingRow, viewer: { id: string; role: Role }): IdeaSummary {
  const masked = maskAuthor(
    {
      id: r.id,
      authorId: r.authorId,
      authorName: r.authorName,
      anonymous: r.anonymous,
    },
    viewer,
  );
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    authorId: masked.authorId,
    authorName: masked.authorName,
    anonymous: r.anonymous,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}

/**
 * Terminal statuses shown in the Employee dashboard History tab
 * (FR-037). Ideas in these states are "concluded" from the
 * Employee's perspective and no longer actionable by the author.
 */
export const CONCLUDED_STATUSES = ["APPROVED", "REJECTED", "IMPLEMENTED"] as const;

/**
 * Wire payload for one row in the Employee History tab (FR-037).
 * Carries only what the tab renders — title, category, the
 * concluded date (= idea.updatedAt at terminal status), and the
 * final decision (= status).
 */
export interface EmployeeHistoryRow {
  id: string;
  title: string;
  categoryName: string;
  concludedAt: string;
  decision: "APPROVED" | "REJECTED" | "IMPLEMENTED";
}

/**
 * Lists the caller's own ideas that have reached a terminal
 * status. Excludes DRAFT (drafts live in a separate table) and any
 * idea still in `SUBMITTED` or `UNDER_REVIEW`. Newest concluded
 * first. Used by the Employee dashboard History tab (FR-037).
 *
 * @example
 *   const rows = await listConcludedByAuthor({ id: session.user.id, role: 'EMPLOYEE' });
 */
export async function listConcludedByAuthor(viewer: {
  id: string;
  role: Role;
}): Promise<EmployeeHistoryRow[]> {
  const rows = await listFiltered(
    {
      authorScope: viewer.id,
      statusWhitelist: CONCLUDED_STATUSES,
    },
    0,
    100,
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    categoryName: r.categoryName,
    concludedAt: new Date(r.updatedAt).toISOString(),
    decision: r.status as EmployeeHistoryRow["decision"],
  }));
}
