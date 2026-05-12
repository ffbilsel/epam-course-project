import { createReadStream, statSync } from "node:fs";
import { Readable } from "node:stream";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { getIdeaDetail } from "@/server/idea-service";
import { findAttachmentByIdeaId } from "@/db/repositories/attachment-repo";
import { AppError } from "@/lib/errors/AppError";

/**
 * GET /api/ideas/:id/attachment — streams the attachment bytes if
 * the caller can see the idea.
 */
export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const detail = await getIdeaDetail(params.id);
    if (
      detail.authorId !== session.user.id &&
      session.user.role !== "EVALUATOR" &&
      session.user.role !== "ADMIN"
    ) {
      throw new AppError("AUTH_FORBIDDEN_ROLE");
    }
    const att = await findAttachmentByIdeaId(detail.id);
    if (!att) throw AppError.notFound("ATTACHMENT_NOT_FOUND");
    const stat = statSync(att.storedPath);
    const stream = Readable.toWeb(createReadStream(att.storedPath)) as unknown as ReadableStream;
    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": att.mimeType,
        "Content-Length": String(stat.size),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(att.originalName)}"`,
      },
    });
  },
);
