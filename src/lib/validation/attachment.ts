import { z } from "zod";

/**
 * `POST /api/ideas/:id/attachments` batch upload constraints
 * (FR-001/002, NFR-001). Files are passed in `multipart/form-data`
 * — this schema validates the *shape* of the parsed batch.
 */
export const ATTACHMENT_LIMIT = 10;
/** Per-file byte cap (25 MB). */
export const ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
/** Per-idea byte cap (100 MB). */
export const ATTACHMENT_TOTAL_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Parsed batch metadata. Each entry mirrors one `File` from the
 * multipart payload.
 */
export const AttachmentBatchUploadSchema = z
  .object({
    files: z
      .array(
        z.object({
          name: z.string().min(1).max(255),
          size: z.number().int().nonnegative().max(ATTACHMENT_MAX_BYTES, {
            message: "ATTACHMENT_TOO_LARGE",
          }),
          mimeType: z.string().min(1),
        }),
      )
      .min(1, { message: "ATTACHMENT_LIMIT_EXCEEDED" })
      .max(ATTACHMENT_LIMIT, { message: "ATTACHMENT_LIMIT_EXCEEDED" }),
  })
  .superRefine((v, ctx) => {
    const total = v.files.reduce((s, f) => s + f.size, 0);
    if (total > ATTACHMENT_TOTAL_MAX_BYTES) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ATTACHMENT_QUOTA_EXCEEDED",
        path: ["files"],
      });
    }
  });

/** Inferred input type for {@link AttachmentBatchUploadSchema}. */
export type AttachmentBatchUploadInput = z.infer<typeof AttachmentBatchUploadSchema>;

/**
 * `PATCH /api/ideas/:id/attachments` reorder body. The id set must
 * equal the current attachment set on the idea — duplicates / unknown
 * ids are rejected with `ATTACHMENT_ORDER_INVALID`.
 */
export const AttachmentReorderSchema = z
  .object({
    orderedIds: z
      .array(z.string().min(1))
      .min(1, { message: "ATTACHMENT_ORDER_INVALID" })
      .max(ATTACHMENT_LIMIT, { message: "ATTACHMENT_ORDER_INVALID" }),
  })
  .superRefine((v, ctx) => {
    const seen = new Set<string>();
    for (const id of v.orderedIds) {
      if (seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "ATTACHMENT_ORDER_INVALID",
          path: ["orderedIds"],
        });
        return;
      }
      seen.add(id);
    }
  });

/** Inferred input type for {@link AttachmentReorderSchema}. */
export type AttachmentReorderInput = z.infer<typeof AttachmentReorderSchema>;
