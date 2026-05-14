import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { markNotificationRead } from "@/server/notification-service";

export const dynamic = "force-dynamic";

/**
 * POST /api/notifications/:id/read — marks one notification as read.
 * Idempotent; 403 `NOTIFICATION_FORBIDDEN` when the caller is not
 * the recipient.
 */
export const POST = withErrorHandler(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    await markNotificationRead(params.id, session.user.id);
    return NextResponse.json({ ok: true });
  },
);
