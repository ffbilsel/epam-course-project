import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { submitDraft } from "@/server/draft-service";

/** POST /api/drafts/[id]/submit — promote a draft to an Idea. */
export const POST = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const result = await submitDraft(id, { id: session.user.id, role: session.user.role });
    return NextResponse.json(result, { status: 201 });
  },
);
