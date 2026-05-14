import { z } from "zod";
import { IDEA_STATUSES } from "@/db/schema";

/**
 * Re-export of the lifecycle statuses for client-side consumers that
 * must not import server-only code from `@/db/schema` at runtime.
 */
export const IDEA_STATUS_VALUES = IDEA_STATUSES;
export type IdeaStatusValue = (typeof IDEA_STATUS_VALUES)[number];

/**
 * Body schema for `POST /api/ideas` (FR-008). An existing
 * `categoryId` is required — proposing a new category is now a
 * separate workflow (`POST /api/categories`, see
 * {@link ProposeCategorySchema}).
 */
export const CreateIdeaSchema = z.object({
  title: z.string().trim().min(1, { message: "IDEA_TITLE_REQUIRED" }).max(120, {
    message: "IDEA_TITLE_TOO_LONG",
  }),
  description: z
    .string()
    .trim()
    .min(1, { message: "IDEA_DESCRIPTION_REQUIRED" })
    .max(2000, { message: "IDEA_DESCRIPTION_TOO_LONG" }),
  categoryId: z.string().uuid({ message: "IDEA_CATEGORY_INVALID" }),
  attachmentId: z.string().uuid().nullable().optional(),
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
/** Inferred TypeScript type for {@link CreateIdeaSchema}. */
export type CreateIdeaInput = z.infer<typeof CreateIdeaSchema>;

/**
 * Body schema for `POST /api/categories` — any authenticated user
 * can propose a new category. The proposal lands in `PROPOSED`
 * state pending Admin approval.
 */
export const ProposeCategorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "IDEA_CATEGORY_INVALID" })
    .max(40, { message: "IDEA_CATEGORY_INVALID" }),
});
/** Inferred TypeScript type for {@link ProposeCategorySchema}. */
export type ProposeCategoryInput = z.infer<typeof ProposeCategorySchema>;

/**
 * Body schema for `POST /api/ideas/:id/transitions`.
 */
export const TransitionSchema = z.object({
  action: z.enum(["START_REVIEW", "APPROVE", "REJECT", "IMPLEMENT"]),
  comment: z.string().max(2000).nullable().optional(),
});
/** Inferred TypeScript type for {@link TransitionSchema}. */
export type TransitionInput = z.infer<typeof TransitionSchema>;

/**
 * Body schema for `PATCH /api/categories/:id`.
 */
export const CategoryDecisionSchema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
});
/** Inferred TypeScript type for {@link CategoryDecisionSchema}. */
export type CategoryDecisionInput = z.infer<typeof CategoryDecisionSchema>;

/**
 * Body schema for `PATCH /api/users/:id/role`.
 */
export const RoleChangeSchema = z.object({
  role: z.enum(["EMPLOYEE", "EVALUATOR", "ADMIN"]),
});
/** Inferred TypeScript type for {@link RoleChangeSchema}. */
export type RoleChangeInput = z.infer<typeof RoleChangeSchema>;

/**
 * Body schema for `PATCH /api/ideas/:id` — author edits the
 * structural fields of their own SUBMITTED idea (Phase 3 / US1).
 * Answer validation against the current category schema happens
 * later, in the service.
 */
export const UpdateIdeaSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, { message: "IDEA_TITLE_REQUIRED" })
    .max(120, { message: "IDEA_TITLE_TOO_LONG" }),
  description: z
    .string()
    .trim()
    .min(1, { message: "IDEA_DESCRIPTION_REQUIRED" })
    .max(2000, { message: "IDEA_DESCRIPTION_TOO_LONG" }),
  categoryId: z.string().uuid({ message: "IDEA_CATEGORY_INVALID" }),
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
/** Inferred TypeScript type for {@link UpdateIdeaSchema}. */
export type UpdateIdeaInput = z.infer<typeof UpdateIdeaSchema>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates an ISO date string is well-formed AND represents a real
 * calendar day. The regex on its own accepts e.g. `2026-13-09`; this
 * helper rejects it.
 */
function isValidIsoDate(s: string): boolean {
  if (!ISO_DATE.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  return (
    dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d
  );
}
const PAGE_SIZES = [20, 50, 100] as const;
export type ListingPageSize = (typeof PAGE_SIZES)[number];

/**
 * Body / query schema for the unified idea listing (FR-007..FR-016
 * + FR-020..FR-023). Parsed once from `URLSearchParams` by every
 * listing surface and the CSV export endpoint.
 *
 * The schema accepts strings (because URL params are always strings)
 * and coerces them. It does NOT enforce per-role scope — that is
 * applied inside `runListingQuery` based on the calling session.
 */
export const ListingQuerySchema = z
  .object({
    q: z.string().trim().max(200, { message: "IDEA_LISTING_SEARCH_TOO_LONG" }).default(""),
    categoryId: z.string().uuid().optional(),
    status: z
      .array(z.enum(IDEA_STATUS_VALUES as readonly [string, ...string[]]))
      .max(IDEA_STATUS_VALUES.length)
      .optional(),
    from: z
      .string()
      .refine(isValidIsoDate, { message: "IDEA_LISTING_RANGE_INVALID" })
      .optional(),
    to: z
      .string()
      .refine(isValidIsoDate, { message: "IDEA_LISTING_RANGE_INVALID" })
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((n): n is ListingPageSize => (PAGE_SIZES as readonly number[]).includes(n), {
        message: "IDEA_LISTING_PAGE_INVALID",
      })
      .default(20),
  })
  .superRefine((v, ctx) => {
    if (v.from && v.to && v.from > v.to) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "IDEA_LISTING_RANGE_INVALID",
      });
    }
  });
/** Inferred TypeScript type for {@link ListingQuerySchema}. */
export type ListingQuery = z.infer<typeof ListingQuerySchema>;

/**
 * Parses a `URLSearchParams` (or any iterable of key/value pairs)
 * into a {@link ListingQuery}. Repeated `status` keys collapse to an
 * array.
 *
 * @throws ZodError on invalid input (handled by `withErrorHandler`).
 */
export function parseListingQuery(
  params: URLSearchParams | Iterable<[string, string]>,
): ListingQuery {
  const sp = params instanceof URLSearchParams ? params : new URLSearchParams([...params]);
  const obj: Record<string, unknown> = {};
  const q = sp.get("q");
  if (q !== null) obj["q"] = q;
  const categoryId = sp.get("categoryId");
  if (categoryId) obj["categoryId"] = categoryId;
  const statuses = sp.getAll("status").filter((s) => s.length > 0);
  if (statuses.length > 0) obj["status"] = statuses;
  const from = sp.get("from");
  if (from) obj["from"] = from;
  const to = sp.get("to");
  if (to) obj["to"] = to;
  const page = sp.get("page");
  if (page !== null && page !== "") obj["page"] = page;
  const pageSize = sp.get("pageSize");
  if (pageSize !== null && pageSize !== "") obj["pageSize"] = pageSize;
  return ListingQuerySchema.parse(obj);
}
