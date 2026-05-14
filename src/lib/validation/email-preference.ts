import { z } from "zod";

/**
 * `PUT /api/me/email-preferences` body. All four toggles optional;
 * unspecified keys keep their previous value (defaults all-on per
 * data-model §7). Unknown keys reject with `EMAIL_PREFERENCE_INVALID`.
 */
export const EmailPreferenceUpdateSchema = z
  .object({
    statusChanges: z.boolean().optional(),
    commentsOnMyIdeas: z.boolean().optional(),
    ratingsOnMyIdeas: z.boolean().optional(),
    repliesOnIdeasIReview: z.boolean().optional(),
  })
  .strict({ message: "EMAIL_PREFERENCE_INVALID" });

/** Inferred TypeScript type for {@link EmailPreferenceUpdateSchema}. */
export type EmailPreferenceUpdateInput = z.infer<typeof EmailPreferenceUpdateSchema>;
