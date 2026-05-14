import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/errors/AppError";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { getVersion } from "@/server/version-service";
import { diffIdeaVersions } from "@/server/diff-service";

export const dynamic = "force-dynamic";

/**
 * GET /api/ideas/:id/versions/diff?from=N&to=M — pure diff between
 * two snapshots; `IDEA_VERSION_RANGE_INVALID` when from >= to.
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireSession();
    const url = new URL(req.url);
    const from = Number.parseInt(url.searchParams.get("from") ?? "", 10);
    const to = Number.parseInt(url.searchParams.get("to") ?? "", 10);
    if (!Number.isFinite(from) || !Number.isFinite(to) || from < 1 || to <= from) {
      throw new AppError("IDEA_VERSION_RANGE_INVALID");
    }
    const viewer = { id: session.user.id, role: session.user.role };
    const a = await getVersion(params.id, from, viewer);
    const b = await getVersion(params.id, to, viewer);
    const diff = diffIdeaVersions(
      {
        versionNo: a.versionNo,
        title: a.title,
        description: a.description,
        categoryAnswers: a.categoryAnswers,
        attachmentIds: a.attachmentIds,
      },
      {
        versionNo: b.versionNo,
        title: b.title,
        description: b.description,
        categoryAnswers: b.categoryAnswers,
        attachmentIds: b.attachmentIds,
      },
    );
    return NextResponse.json(diff);
  },
);
