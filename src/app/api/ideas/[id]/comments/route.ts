import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { listThread, postComment } from "@/server/comment-service";

/** GET /api/ideas/[id]/comments — return the one-level thread. */
export const GET = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await requireSession();
    const { id } = await ctx.params;
    return NextResponse.json({ rows: await listThread(id) });
  },
);

/** POST /api/ideas/[id]/comments — append a new comment or reply. */
export const POST = withErrorHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = (await req.json()) as unknown;
    const out = await postComment(id, { id: session.user.id, role: session.user.role }, body);
    return NextResponse.json(out, { status: 201 });
  },
);
