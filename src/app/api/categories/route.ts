import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession, requireRole } from "@/server/role-guard";
import { listCategories } from "@/db/repositories/category-repo";
import { proposeCategory } from "@/server/category-service";
import { ProposeCategorySchema } from "@/lib/validation/idea";
import type { CategoryState } from "@/db/schema";

/**
 * GET /api/categories?state=ACTIVE|PROPOSED|REJECTED|all
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const stateRaw = req.nextUrl.searchParams.get("state");
  if (stateRaw === "all" || stateRaw === "PROPOSED" || stateRaw === "REJECTED") {
    await requireRole("ADMIN");
    const cats = stateRaw === "all" ? await listCategories() : await listCategories(stateRaw);
    return NextResponse.json(cats);
  }
  const state: CategoryState = (stateRaw as CategoryState) ?? "ACTIVE";
  const cats = await listCategories(state);
  void session;
  return NextResponse.json(cats);
});

/**
 * POST /api/categories — any authenticated user proposes a new
 * category. Lands in `PROPOSED` state pending an Admin decision.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const body = (await req.json()) as unknown;
  const parsed = ProposeCategorySchema.parse(body);
  const created = await proposeCategory(parsed.name, session.user.id, session.user.role);
  return NextResponse.json(created, { status: 201 });
});
