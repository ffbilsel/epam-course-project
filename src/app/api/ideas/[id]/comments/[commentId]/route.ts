import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { deleteComment, editComment } from "@/server/comment-service";

/** PATCH /api/ideas/[id]/comments/[commentId] — edit within 5 min. */
export const PATCH = withErrorHandler(
  async (
    req: NextRequest,
    ctx: { params: Promise<{ id: string; commentId: string }> },
  ) => {
    const session = await requireSession();
    const { id, commentId } = await ctx.params;
    const body = (await req.json()) as unknown;
    await editComment(id, commentId, { id: session.user.id, role: session.user.role }, body);
    return new NextResponse(null, { status: 204 });
  },
);

/** DELETE /api/ideas/[id]/comments/[commentId] — soft-delete (author or moderator). */
export const DELETE = withErrorHandler(
  async (
    _req: NextRequest,
    ctx: { params: Promise<{ id: string; commentId: string }> },
  ) => {
    const session = await requireSession();
    const { id, commentId } = await ctx.params;
    await deleteComment(id, commentId, { id: session.user.id, role: session.user.role });
    return new NextResponse(null, { status: 204 });
  },
);
