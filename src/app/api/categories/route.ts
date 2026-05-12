import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession, requireRole } from "@/server/role-guard";
import { listCategories } from "@/db/repositories/category-repo";
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
