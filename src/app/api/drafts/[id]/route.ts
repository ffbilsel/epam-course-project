import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { saveDraft, loadDraft, deleteDraft } from "@/server/draft-service";

/** GET /api/drafts/[id] — load a single draft. */
export const GET = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const draft = await loadDraft(id, { id: session.user.id });
    return NextResponse.json(draft);
  },
);

/** PUT /api/drafts/[id] — patch (autosave) an existing draft. */
export const PUT = withErrorHandler(
  async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSession();
    const { id } = await ctx.params;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const input: Parameters<typeof saveDraft>[0] = { id };
    if (typeof body["title"] === "string") input.title = body["title"];
    if (typeof body["description"] === "string") input.description = body["description"];
    if ("categoryId" in body) input.categoryId = body["categoryId"] as string | null;
    if (body["answers"] && typeof body["answers"] === "object") {
      input.answers = body["answers"] as Record<string, unknown>;
    }
    const draft = await saveDraft(input, { id: session.user.id });
    return NextResponse.json(draft);
  },
);

/** DELETE /api/drafts/[id] — delete a draft. */
export const DELETE = withErrorHandler(
  async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
    const session = await requireSession();
    const { id } = await ctx.params;
    await deleteDraft(id, { id: session.user.id });
    return new NextResponse(null, { status: 204 });
  },
);
