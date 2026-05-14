import { AppError } from "@/lib/errors/AppError";
import {
  countFiltered,
  listFiltered,
  type IdeaListingRow,
  type ListingPredicate,
} from "@/db/repositories/idea-repo";
import type { ListingQuery, ListingPageSize } from "@/lib/validation/idea";
import type { Role } from "@/db/schema";

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
 *
 * @throws AUTH_FORBIDDEN_ROLE when the role isn't allowed for the scope.
 */
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
  const base: ListingPredicate = {
    q: query.q || undefined,
    categoryId: query.categoryId,
    status: query.status as ListingPredicate["status"],
    from: query.from,
    to: query.to,
  };
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
    rows: rows.map(toSummary),
    total,
    page,
    pageSize: query.pageSize as ListingPageSize,
    totalPages,
  };
}

function toSummary(r: IdeaListingRow): IdeaSummary {
  return {
    id: r.id,
    title: r.title,
    status: r.status,
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    authorId: r.authorId,
    authorName: r.authorName,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
  };
}
