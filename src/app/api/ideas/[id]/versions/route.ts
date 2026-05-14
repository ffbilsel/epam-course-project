import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { listVersions } from "@/server/version-service";

export const dynamic = "force-dynamic";

/** GET /api/ideas/:id/versions — list every snapshot, oldest first. */
export const GET = withErrorHandler(
  async (_req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const rows = await listVersions(params.id, {
      id: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json({ items: rows });
  },
);
