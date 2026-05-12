import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireRole } from "@/server/role-guard";
import { CategoryDecisionSchema } from "@/lib/validation/idea";
import { approveCategory, rejectCategory } from "@/server/category-service";

/**
 * PATCH /api/categories/:id — admin-only approve/reject.
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole("ADMIN");
    const body = (await req.json()) as unknown;
    const parsed = CategoryDecisionSchema.parse(body);
    if (parsed.decision === "APPROVE") {
      await approveCategory(params.id, session.user.id);
    } else {
      await rejectCategory(params.id, session.user.id);
    }
    return NextResponse.json({ ok: true });
  },
);
