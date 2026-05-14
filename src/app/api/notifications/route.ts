import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { listForUser } from "@/server/notification-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/notifications — returns `{ unreadCount, items }` for the
 * caller. Used by the in-app badge poller every 60 s (ADR-0026).
 */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await requireSession();
  const data = await listForUser(session.user.id);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
