import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireRole } from "@/server/role-guard";
import { getRatings, putRatings } from "@/server/rating-service";

/** GET /api/ideas/[id]/ratings — read every dimension + rating row. */
export const GET = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    await requireRole(["EVALUATOR", "ADMIN", "EMPLOYEE"]);
    const { id } = await ctx.params;
    return NextResponse.json(await getRatings(id));
  },
);

/** PUT /api/ideas/[id]/ratings — write the caller's per-dimension scores. */
export const PUT = withErrorHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireRole(["EVALUATOR", "ADMIN"]);
    const { id } = await ctx.params;
    const body = (await req.json()) as unknown;
    const out = await putRatings(id, { id: session.user.id, role: session.user.role }, body);
    return NextResponse.json(out);
  },
);
