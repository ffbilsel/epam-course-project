import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireRole } from "@/server/role-guard";
import { InsightsRangeSchema } from "@/lib/validation/insights";
import { getCategoryDistribution } from "@/server/insights-service";

export const dynamic = "force-dynamic";

/** GET /api/insights/category-distribution — Per-category share of submissions. */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireRole(["EVALUATOR", "ADMIN"]);
  const url = new URL(req.url);
  const parsed = InsightsRangeSchema.parse({
    preset: url.searchParams.get("preset") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    bucket: url.searchParams.get("bucket") ?? undefined,
  });
  const out = getCategoryDistribution(parsed, { id: session.user.id, role: session.user.role });
  return NextResponse.json(out);
});
