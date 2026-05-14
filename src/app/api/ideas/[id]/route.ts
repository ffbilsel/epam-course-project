import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import {
  getIdeaDetail,
  listIdeaTransitions,
  editIdea,
  deleteIdea,
  setIdeaAnonymity,
} from "@/server/idea-service";
import { UpdateIdeaSchema } from "@/lib/validation/idea";
import { AppError } from "@/lib/errors/AppError";

/**
 * GET /api/ideas/:id — author or reviewer/admin only.
 */
export const GET = withErrorHandler(
  async (_req: Request, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const detail = await getIdeaDetail(params.id, {
      id: session.user.id,
      role: session.user.role,
    });
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

/**
 * PATCH /api/ideas/:id — author edits an own SUBMITTED idea (US1),
 * or Admin toggles the anonymous flag (US3 / ADR-0018).
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const body = (await req.json()) as unknown;
    // Admin anonymity override branch
    if (
      session.user.role === "ADMIN" &&
      body &&
      typeof body === "object" &&
      "anonymous" in (body as Record<string, unknown>) &&
      typeof (body as { anonymous?: unknown }).anonymous === "boolean"
    ) {
      const updated = await setIdeaAnonymity(
        params.id,
        (body as { anonymous: boolean }).anonymous,
        { id: session.user.id, role: session.user.role },
      );
      return NextResponse.json(updated);
    }
    const parsed = UpdateIdeaSchema.parse(body);
    const updated = await editIdea(params.id, parsed, {
      id: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json(updated);
  },
);

/**
 * DELETE /api/ideas/:id — author hard-deletes an own SUBMITTED idea (US1).
 */
export const DELETE = withErrorHandler(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    await deleteIdea(params.id, { id: session.user.id, role: session.user.role });
    return new NextResponse(null, { status: 204 });
  },
);
