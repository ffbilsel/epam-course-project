import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { attachToIdea, listForIdea, reorderAttachments } from "@/server/attachment-service";
import { AttachmentReorderSchema } from "@/lib/validation/attachment";
import { AppError } from "@/lib/errors/AppError";

export const dynamic = "force-dynamic";

/**
 * GET /api/ideas/:id/attachments — ordered attachment list for any
 * viewer who can see the idea.
 */
export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const items = await listForIdea({
      ideaId: params.id,
      viewer: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ items });
  },
);

/**
 * POST /api/ideas/:id/attachments — multipart batch upload.
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const form = await req.formData();
    const raw = form.getAll("files").filter((v): v is File => v instanceof File);
    if (raw.length === 0) {
      throw new AppError("VALIDATION_ERROR", { field: "files" });
    }
    const files = await Promise.all(
      raw.map(async (f) => ({
        buffer: Buffer.from(await f.arrayBuffer()),
        originalName: f.name,
      })),
    );
    const items = await attachToIdea({
      ideaId: params.id,
      files,
      actor: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ items }, { status: 201 });
  },
);

/**
 * PATCH /api/ideas/:id/attachments — reorder the attachment list.
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const body = AttachmentReorderSchema.parse(await req.json());
    await reorderAttachments({
      ideaId: params.id,
      orderedIds: body.orderedIds,
      actor: { id: session.user.id, role: session.user.role },
    });
    return NextResponse.json({ ok: true });
  },
);
