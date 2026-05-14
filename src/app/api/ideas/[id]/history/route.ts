import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { getIdeaHistory } from "@/server/idea-history";

interface RouteParams {
  params: { id: string };
}

/**
 * GET /api/ideas/[id]/history — combined audit timeline for one
 * idea. Authorisation is enforced inside the service.
 */
export const GET = withErrorHandler(async (_req: NextRequest, { params }: RouteParams) => {
  const session = await requireSession();
  const events = await getIdeaHistory(params.id, {
    id: session.user.id,
    role: session.user.role,
  });
  return NextResponse.json({ events });
});
