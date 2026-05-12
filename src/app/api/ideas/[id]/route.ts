import { NextResponse } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { getIdeaDetail, listIdeaTransitions } from "@/server/idea-service";
import { AppError } from "@/lib/errors/AppError";

/**
 * GET /api/ideas/:id — author or reviewer/admin only.
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
    const transitions = await listIdeaTransitions(detail.id);
    return NextResponse.json({ ...detail, transitions });
  },
);
