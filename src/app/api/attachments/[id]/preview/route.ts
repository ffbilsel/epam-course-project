import { readFileSync } from "node:fs";
import { type NextRequest } from "next/server";
import { withErrorHandler, errorResponse } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { loadAttachment } from "@/server/attachment-service";
import { findIdeaById } from "@/db/repositories/idea-repo";
import { sanitizeMarkdownHtml } from "@/lib/format/plain-text";
import { AppError } from "@/lib/errors/AppError";

export const dynamic = "force-dynamic";

function safeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "file";
}

function baseHeaders(att: { originalName: string }): Record<string, string> {
  return {
    "Content-Disposition": `inline; filename="${safeFilename(att.originalName)}"`,
    "Content-Security-Policy": "sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}

/**
 * GET /api/attachments/:id/preview — streams an attachment with
 * sandboxed CSP for inline preview (ADR-0025). SVGs are rejected
 * with `ATTACHMENT_PREVIEW_UNSUPPORTED` (415); markdown is
 * sanitised server-side and returned as `text/html`.
 */
export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const att = await loadAttachment(params.id);

    // Authorisation: read access mirrors idea detail. Staged
    // attachments (ideaId NULL) are only visible to their uploader.
    if (att.ideaId) {
      const idea = await findIdeaById(att.ideaId);
      if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
      const canRead =
        idea.authorId === session.user.id ||
        session.user.role === "EVALUATOR" ||
        session.user.role === "ADMIN";
      if (!canRead) throw new AppError("ATTACHMENT_FORBIDDEN");
    } else if (att.uploaderId !== session.user.id) {
      throw new AppError("ATTACHMENT_FORBIDDEN");
    }

    if (att.mimeType === "image/svg+xml") {
      return errorResponse("ATTACHMENT_PREVIEW_UNSUPPORTED", undefined, { mimeType: att.mimeType });
    }

    if (att.mimeType === "text/markdown" || att.mimeType === "text/plain") {
      const raw = readFileSync(att.storedPath, "utf8");
      const html = sanitizeMarkdownHtml(raw);
      return new Response(html, {
        status: 200,
        headers: { ...baseHeaders(att), "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const bytes = readFileSync(att.storedPath);
    return new Response(bytes, {
      status: 200,
      headers: {
        ...baseHeaders(att),
        "Content-Type": att.mimeType,
        "Content-Length": String(bytes.byteLength),
      },
    });
  },
);
