import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { rateLimit } from "@/server/rate-limit";
import { RegisterSchema } from "@/lib/validation/auth";
import { registerUser } from "@/server/user-service";

/**
 * POST /api/auth/register — public self-registration (FR-001..FR-005b).
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await rateLimit("register", ip);
  const body = (await req.json()) as unknown;
  const parsed = RegisterSchema.parse(body);
  const user = await registerUser(parsed);
  return NextResponse.json(user, { status: 201 });
});
