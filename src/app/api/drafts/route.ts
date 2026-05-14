import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { saveDraft, listMyDrafts } from "@/server/draft-service";

/** POST /api/drafts — create a new draft (autosave entry point). */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const input: Parameters<typeof saveDraft>[0] = {};
  if (typeof body["title"] === "string") input.title = body["title"];
  if (typeof body["description"] === "string") input.description = body["description"];
  if ("categoryId" in body) input.categoryId = body["categoryId"] as string | null;
  if (body["answers"] && typeof body["answers"] === "object") {
    input.answers = body["answers"] as Record<string, unknown>;
  }
  const draft = await saveDraft(input, { id: session.user.id });
  return NextResponse.json(draft, { status: 201 });
});

/** GET /api/drafts — list the caller's drafts. */
export const GET = withErrorHandler(async () => {
  const session = await requireSession();
  const rows = await listMyDrafts(session.user.id);
  return NextResponse.json({ rows });
});
