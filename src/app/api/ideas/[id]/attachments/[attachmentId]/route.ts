import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { removeAttachment } from "@/server/attachment-service";

export const dynamic = "force-dynamic";

/**
 * DELETE /api/ideas/:id/attachments/:attachmentId — author removes
 * one attachment from an editable idea.
 */
export const DELETE = withErrorHandler(
  async (
    _req: NextRequest,
    { params }: { params: { id: string; attachmentId: string } },
  ) => {
    const session = await requireSession();
    await removeAttachment({
      attachmentId: params.attachmentId,
      actor: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ ok: true });
  },
);
