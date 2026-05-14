import { z } from "zod";

/**
 * `PUT /api/drafts/:id` — every field is optional so the autosave
 * loop can ship partial state. Title and description are bounded by
 * the same upper limits as a real submission to keep storage
 * predictable.
 */
export const SaveDraftSchema = z.object({
  title: z.string().max(120, { message: "IDEA_TITLE_TOO_LONG" }).optional(),
  description: z.string().max(2000, { message: "IDEA_DESCRIPTION_TOO_LONG" }).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  answers: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
/** Inferred TypeScript type for {@link SaveDraftSchema}. */
export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;

/**
 * `POST /api/drafts/:id/submit` — the draft must already satisfy
 * the same constraints as a brand-new idea (FR-001, FR-002).
 * Category-answer validation runs in the service against the
 * current category schema.
 */
export const SubmitDraftSchema = z.object({
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
/** Inferred TypeScript type for {@link SubmitDraftSchema}. */
export type SubmitDraftInput = z.infer<typeof SubmitDraftSchema>;
