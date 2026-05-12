import { NextResponse, type NextRequest } from "next/server";
import { withErrorHandler } from "@/lib/errors/with-error-handler";
import { rateLimit } from "@/server/rate-limit";
import { requireSession } from "@/server/role-guard";
import { stageUpload } from "@/server/attachment-service";
import { AppError } from "@/lib/errors/AppError";

/**
 * Stage an upload (idea-less). Returns the attachment id which the
 * client passes back to `POST /api/ideas`.
 */
export const POST = withErrorHandler(async (req: NextRequest) => {
  const session = await requireSession();
  await rateLimit("attachments", session.user.id);

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    throw new AppError("VALIDATION_ERROR", { field: "file" });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await stageUpload(buf, file.name, session.user.id);
  return NextResponse.json(
    {
      id: result.id,
      originalName: result.originalName,
      mimeType: result.mimeType,
      sizeBytes: result.sizeBytes,
    },
    { status: 201 },
  );
});
