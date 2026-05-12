import { mkdirSync, createWriteStream, statSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import { insertStagedAttachment, findAttachmentById } from "@/db/repositories/attachment-repo";

const STAGING_DIR = join(process.cwd(), "data", "uploads", ".staging");
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
]);

/**
 * Sanitises a user-supplied filename for safe filesystem use.
 */
function sanitise(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "file";
}

/**
 * Stages an upload onto disk under `data/uploads/.staging/` and
 * inserts a row with `idea_id = NULL`. Magic-number sniff against
 * the first 4 KB enforces the MIME allow-list per FR-011.
 */
export async function stageUpload(
  bytes: Buffer,
  originalName: string,
  uploaderId: string,
  deps: { clock?: Clock; ids?: IdGenerator } = {},
): Promise<{
  id: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
  originalName: string;
}> {
  const clock = deps.clock ?? SystemClock;
  const ids = deps.ids ?? SystemIdGenerator;

  if (bytes.byteLength > MAX_BYTES) {
    throw new AppError("ATTACHMENT_TOO_LARGE", { maxBytes: MAX_BYTES });
  }
  const sniff = await fileTypeFromBuffer(bytes.subarray(0, 4096));
  const mime = sniff?.mime;
  if (!mime || !ALLOWED_MIME.has(mime)) {
    throw new AppError("ATTACHMENT_TYPE_NOT_ALLOWED", { detected: mime ?? null });
  }

  mkdirSync(STAGING_DIR, { recursive: true });
  const id = ids.next();
  const safe = sanitise(originalName);
  const storedPath = join(STAGING_DIR, `${id}__${safe}`);

  await new Promise<void>((resolve, reject) => {
    const out = createWriteStream(storedPath);
    Readable.from(bytes).pipe(out).on("finish", resolve).on("error", reject);
  });
  const sz = statSync(storedPath).size;

  await insertStagedAttachment({
    id,
    ideaId: null,
    uploaderId,
    originalName,
    storedPath,
    mimeType: mime,
    sizeBytes: sz,
    uploadedAt: clock.now().getTime(),
  });

  return { id, storedPath, mimeType: mime, sizeBytes: sz, originalName };
}

/**
 * Loads an attachment by id (404 if not found).
 */
export async function loadAttachment(id: string): Promise<{
  id: string;
  ideaId: string | null;
  uploaderId: string;
  originalName: string;
  storedPath: string;
  mimeType: string;
  sizeBytes: number;
}> {
  const a = await findAttachmentById(id);
  if (!a) throw AppError.notFound("ATTACHMENT_NOT_FOUND");
  return a;
}
