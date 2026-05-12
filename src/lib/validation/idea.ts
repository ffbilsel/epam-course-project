import { z } from "zod";

/**
 * Body schema for `POST /api/ideas` (FR-008). Either an existing
 * categoryId or a proposed category name MUST be provided.
 */
export const CreateIdeaSchema = z
  .object({
    title: z.string().trim().min(1, { message: "IDEA_TITLE_REQUIRED" }).max(120, {
      message: "IDEA_TITLE_TOO_LONG",
    }),
    description: z
      .string()
      .trim()
      .min(1, { message: "IDEA_DESCRIPTION_REQUIRED" })
      .max(2000, { message: "IDEA_DESCRIPTION_TOO_LONG" }),
    categoryId: z.string().uuid().optional(),
    proposedCategoryName: z.string().trim().min(1).max(40).optional(),
    attachmentId: z.string().uuid().nullable().optional(),
  })
  .refine((v) => Boolean(v.categoryId) !== Boolean(v.proposedCategoryName), {
    message: "IDEA_CATEGORY_INVALID",
    path: ["categoryId"],
  });
/** Inferred TypeScript type for {@link CreateIdeaSchema}. */
export type CreateIdeaInput = z.infer<typeof CreateIdeaSchema>;

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
