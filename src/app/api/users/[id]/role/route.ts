import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireRole } from "@/server/role-guard";
import { RoleChangeSchema } from "@/lib/validation/idea";
import { changeRole } from "@/server/user-service";

/**
 * PATCH /api/users/:id/role — admin-only role change.
 */
export const PATCH = withErrorHandler(
  async (req: NextRequest, { params }: { params: { id: string } }) => {
    const session = await requireRole("ADMIN");
    const body = (await req.json()) as unknown;
    const parsed = RoleChangeSchema.parse(body);
    await changeRole(params.id, parsed.role, { id: session.user.id, role: session.user.role });
    return NextResponse.json({ ok: true });
  },
);
