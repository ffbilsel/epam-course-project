import { z } from "zod";

/**
 * `GET /api/ideas/:id/versions/diff?from=&to=` query schema per
 * data-model §4. Both numbers are 1-based version numbers; `from`
 * must be strictly less than `to` (ADR-0024).
 */
export const VersionRangeSchema = z
  .object({
    from: z.coerce.number().int().min(1, { message: "IDEA_VERSION_RANGE_INVALID" }),
    to: z.coerce.number().int().min(1, { message: "IDEA_VERSION_RANGE_INVALID" }),
  })
  .refine((v) => v.from < v.to, {
    message: "IDEA_VERSION_RANGE_INVALID",
    path: ["from"],
  });

/** Inferred TypeScript type for {@link VersionRangeSchema}. */
export type VersionRangeInput = z.infer<typeof VersionRangeSchema>;
