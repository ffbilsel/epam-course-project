import { z } from "zod";

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
