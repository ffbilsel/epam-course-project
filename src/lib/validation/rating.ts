import { z } from "zod";

/**
 * Valid score values for a single dimension. `null` = explicitly
 * unrated (the evaluator left it blank).
 */
export const RATING_SCORE_VALUES = [1, 2, 3, 4, 5] as const;
export type RatingScore = (typeof RATING_SCORE_VALUES)[number] | null;

/**
 * `PUT /api/ideas/:id/ratings` body. The service upserts one row
 * per submitted `dimensionId` and rejects unknown dimensions or
 * any change to a locked row.
 */
export const RatingPutSchema = z.object({
  scores: z
    .array(
      z.object({
        dimensionId: z.string().min(1),
        score: z.union(
          [
            z.literal(null),
            z.literal(1),
            z.literal(2),
            z.literal(3),
            z.literal(4),
            z.literal(5),
          ],
          { errorMap: () => ({ message: "RATING_INVALID_SCORE" }) },
        ),
      }),
    )
    .max(20),
});
/** Inferred TypeScript type for {@link RatingPutSchema}. */
export type RatingPutInput = z.infer<typeof RatingPutSchema>;
