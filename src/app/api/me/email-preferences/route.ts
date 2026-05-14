import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { requireSession } from "@/server/role-guard";
import { getPreferences, updatePreferences } from "@/server/email-preference-service";
import { EmailPreferenceUpdateSchema } from "@/lib/validation/email-preference";

export const dynamic = "force-dynamic";

/** GET /api/me/email-preferences — returns the caller's preferences. */
export const GET = withErrorHandler(async (_req: NextRequest) => {
  const session = await requireSession();
  const prefs = await getPreferences(session.user.id);
  return NextResponse.json(prefs);
});

/** PUT /api/me/email-preferences — patches the caller's preferences. */
export const PUT = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  const patch = EmailPreferenceUpdateSchema.parse(await req.json());
  const prefs = await updatePreferences(session.user.id, patch);
  return NextResponse.json(prefs);
});
