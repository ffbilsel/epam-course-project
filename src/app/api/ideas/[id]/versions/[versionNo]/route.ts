import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/errors/AppError";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { getVersion } from "@/server/version-service";

export const dynamic = "force-dynamic";

/** GET /api/ideas/:id/versions/:versionNo — one snapshot. */
export const GET = withErrorHandler(
  async (
    _req: NextRequest,
    { params }: { params: { id: string; versionNo: string } },
  ) => {
    const session = await requireSession();
    const n = Number.parseInt(params.versionNo, 10);
    if (!Number.isFinite(n) || n < 1) {
      throw new AppError("IDEA_VERSION_RANGE_INVALID");
    }
    const row = await getVersion(params.id, n, {
      id: session.user.id,
      role: session.user.role,
    });
    return NextResponse.json(row);
  },
);
