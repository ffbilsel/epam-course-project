import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { CreateIdeaSchema, parseListingQuery } from "@/lib/validation/idea";
import { createIdea } from "@/server/idea-service";
import { runListingQuery } from "@/server/idea-listing";

/**
 * POST /api/ideas — create a new idea (Employee+).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const body = (await req.json()) as unknown;
  const parsed = CreateIdeaSchema.parse(body);
  const idea = await createIdea(parsed, session.user.id);
  return NextResponse.json(idea, { status: 201 });
});

/**
 * GET /api/ideas — paginated listing with shared filter contract
 * (see `specs/003-idea-listing-management/data-model.md`). The
 * `scope` URL param chooses between `mine` (default), `queue`
 * (reviewer/admin), or `all` (admin).
 *
 * Out-of-range pages are clamped server-side; in that case the
 * response carries `Cache-Control: no-store` so browsers don't
 * pin the redirected page (FR-021).
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const params = new URLSearchParams(req.nextUrl.searchParams);
  if (!params.has("scope")) {
    params.set("scope", session.user.role === "EMPLOYEE" ? "mine" : "queue");
  }
  const query = parseListingQuery(params);
  const result = await runListingQuery(query, {
    id: session.user.id,
    role: session.user.role,
  });
  const headers: HeadersInit = {};
  if (result.page !== query.page) {
    headers["Cache-Control"] = "no-store";
  }
  return NextResponse.json(result, { headers });
});
