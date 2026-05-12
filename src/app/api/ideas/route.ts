import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { CreateIdeaSchema } from "@/lib/validation/idea";
import { createIdea, listMineIdeas, listQueueIdeas } from "@/server/idea-service";
import { AppError } from "@/lib/errors/AppError";

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
 * GET /api/ideas?scope=mine|queue — list ideas.
 */
export const GET = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const scope = req.nextUrl.searchParams.get("scope") ?? defaultScope(session.user.role);
  if (scope === "mine") {
    return NextResponse.json(await listMineIdeas(session.user.id));
  }
  if (scope === "queue") {
    if (session.user.role === "EMPLOYEE") {
      throw new AppError("AUTH_FORBIDDEN_ROLE");
    }
    return NextResponse.json(await listQueueIdeas());
  }
  throw new AppError("VALIDATION_ERROR", { field: "scope" });
});

function defaultScope(role: string): "mine" | "queue" {
  return role === "EMPLOYEE" ? "mine" : "queue";
}
