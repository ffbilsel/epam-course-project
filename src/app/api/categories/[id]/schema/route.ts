import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireRole, requireSession } from "@/server/role-guard";
import { getCategorySchema, saveCategorySchema } from "@/server/category-service";

interface RouteContext {
  params: { id: string };
}

/**
 * GET /api/categories/:id/schema — returns the live structured
 * field schema for the category. Available to any authenticated
 * caller; the client form needs it to render dynamic fields.
 */
export const GET = withErrorHandler(async (_req: NextRequest, context: unknown) => {
  await requireSession();
  const { params } = context as RouteContext;
  const fields = await getCategorySchema(params.id);
  return NextResponse.json({ fields });
});

/**
 * PUT /api/categories/:id/schema — replaces the schema. Admin-only.
 * Body shape: `{ fields: CategoryFieldDefinition[] }`. Returns the
 * persisted schema on success.
 */
export const PUT = withErrorHandler(async (req: NextRequest, context: unknown) => {
  const session = await requireRole("ADMIN");
  const { params } = context as RouteContext;
  const body = (await req.json()) as { fields?: unknown };
  const saved = await saveCategorySchema(params.id, body?.fields ?? body, session.user.id);
  return NextResponse.json({ fields: saved });
});
