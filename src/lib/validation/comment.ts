import { z } from "zod";

/**
 * `POST /api/ideas/:id/comments` body. Comments are plain text
 * (NFR-007); HTML escaping happens at render time via
 * {@link escapeAndLinebreak}.
 */
export const CommentPostSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { message: "COMMENT_TOO_LONG" })
    .max(2000, { message: "COMMENT_TOO_LONG" }),
  parentId: z.string().uuid().nullable().optional(),
});
/** Inferred TypeScript type for {@link CommentPostSchema}. */
export type CommentPostInput = z.infer<typeof CommentPostSchema>;

/**
 * `PATCH /api/ideas/:id/comments/:commentId` body.
 */
export const CommentEditSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, { message: "COMMENT_TOO_LONG" })
    .max(2000, { message: "COMMENT_TOO_LONG" }),
});
/** Inferred TypeScript type for {@link CommentEditSchema}. */
export type CommentEditInput = z.infer<typeof CommentEditSchema>;
