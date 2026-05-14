import { type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { parseListingQuery } from "@/lib/validation/idea";
import { streamIdeasCsv } from "@/server/idea-export";

export const dynamic = "force-dynamic";

/**
 * GET /api/ideas/export — admin-only RFC 4180 CSV stream of the
 * current filter set (ADR-0016). Filters mirror the listing API.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const params = new URLSearchParams(req.nextUrl.searchParams);
  params.set("scope", "all");
  const query = parseListingQuery(params);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const requestId = req.headers.get("x-request-id");
  const stream = await streamIdeasCsv(query, {
    id: session.user.id,
    role: session.user.role,
    ip,
    requestId,
  });
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="ideas-export.csv"',
      "Cache-Control": "no-store",
    },
  });
});
