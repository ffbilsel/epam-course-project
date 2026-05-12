import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireRole } from "@/server/role-guard";
import { TransitionSchema } from "@/lib/validation/idea";
import { applyTransition } from "@/server/idea-service";

/**
 * POST /api/ideas/:id/transitions — reviewer/admin moves an idea
 * along the state machine.
 */
export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole(["EVALUATOR", "ADMIN"]);
    const body = (await req.json()) as unknown;
    const parsed = TransitionSchema.parse(body);
    const detail = await applyTransition(params.id, parsed.action, parsed.comment ?? null, {
      id: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json(detail);
  },
);
