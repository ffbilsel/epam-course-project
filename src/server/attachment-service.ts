import { mkdirSync, createWriteStream, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import { AppError } from "@/lib/errors/AppError";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import { logSecurityEvent } from "@/server/infra/logger";
import {
  insertStagedAttachment,
  findAttachmentById,
  listByIdeaOrdered,
  sumBytesForIdea,
  insertBatch,
  reorder as reorderRepo,
  deleteAttachment as deleteAttachmentRepo,
} from "@/db/repositories/attachment-repo";
import { findIdeaById } from "@/db/repositories/idea-repo";
import {
  ATTACHMENT_LIMIT,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_TOTAL_MAX_BYTES,
} from "@/lib/validation/attachment";
import type { AttachmentSummary, AttachmentPreviewKind } from "@/types";
import type { Role } from "@/db/schema";

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
  // Sniff against the full buffer: OOXML (.docx/.pptx) are ZIP archives whose
  // discriminator lives in the central directory at the END of the file, so a
  // truncated buffer would only resolve to `application/zip` and be rejected.
  const sniff = await fileTypeFromBuffer(bytes);
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

const EDITABLE_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW"]);

/**
 * Derives the preview classification from a MIME type (Phase 5 §2).
 * @example previewKindFor('image/png') === 'image'
 */
export function previewKindFor(mime: string): AttachmentPreviewKind {
  if (mime === "image/svg+xml") return "download";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (mime === "text/markdown" || mime === "text/plain") return "text";
  return "download";
}

function toSummary(row: {
  id: string;
  ideaId: string | null;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  displayOrder: number;
  uploadedAt: number;
}): AttachmentSummary {
  return {
    id: row.id,
    ideaId: row.ideaId,
    originalName: row.originalName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    displayOrder: row.displayOrder,
    uploadedAt: new Date(row.uploadedAt).toISOString(),
    previewKind: previewKindFor(row.mimeType),
  };
}

async function loadOwnedIdeaForEdit(
  ideaId: string,
  actor: { id: string; role: Role },
): Promise<{ id: string; authorId: string; status: string }> {
  const idea = await findIdeaById(ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  if (idea.authorId !== actor.id) throw new AppError("ATTACHMENT_FORBIDDEN");
  if (!EDITABLE_STATUSES.has(idea.status)) {
    throw new AppError("ATTACHMENT_FORBIDDEN", { status: idea.status });
  }
  return { id: idea.id, authorId: idea.authorId, status: idea.status };
}

/**
 * Phase 5 — Attaches a batch of files to an idea. Validates count,
 * per-file size, and aggregate quota; sniffs MIME against the
 * allow-list; emits one `attachment_added` audit event per file.
 */
// eslint-disable-next-line max-lines-per-function, complexity -- linear sequence of validation gates per FR-001..005
export async function attachToIdea(args: {
  ideaId: string;
  files: Array<{ buffer: Buffer; originalName: string }>;
  actor: { id: string; role: Role };
  deps?: { clock?: Clock; ids?: IdGenerator };
}): Promise<AttachmentSummary[]> {
  const { ideaId, files, actor } = args;
  const clock = args.deps?.clock ?? SystemClock;
  const ids = args.deps?.ids ?? SystemIdGenerator;

  await loadOwnedIdeaForEdit(ideaId, actor);

  if (files.length === 0) {
    throw new AppError("VALIDATION_ERROR", { field: "files" });
  }

  const existing = await listByIdeaOrdered(ideaId);
  if (existing.length + files.length > ATTACHMENT_LIMIT) {
    throw new AppError("ATTACHMENT_LIMIT_EXCEEDED", {
      existing: existing.length,
      adding: files.length,
      limit: ATTACHMENT_LIMIT,
    });
  }

  const existingBytes = await sumBytesForIdea(ideaId);
  const addBytes = files.reduce((s, f) => s + f.buffer.byteLength, 0);
  if (existingBytes + addBytes > ATTACHMENT_TOTAL_MAX_BYTES) {
    throw new AppError("ATTACHMENT_QUOTA_EXCEEDED", {
      total: existingBytes + addBytes,
      limit: ATTACHMENT_TOTAL_MAX_BYTES,
    });
  }

  for (const f of files) {
    if (f.buffer.byteLength > ATTACHMENT_MAX_BYTES) {
      throw new AppError("ATTACHMENT_TOO_LARGE", {
        maxBytes: ATTACHMENT_MAX_BYTES,
        actual: f.buffer.byteLength,
      });
    }
  }

  const ideaDir = join(process.cwd(), "data", "uploads", ideaId);
  mkdirSync(ideaDir, { recursive: true });

  const rows: Array<{
    id: string;
    ideaId: string;
    uploaderId: string;
    originalName: string;
    storedPath: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: number;
    displayOrder: number;
  }> = [];

  for (let i = 0; i < files.length; i += 1) {
    const f = files[i]!;
    const sniff = await fileTypeFromBuffer(f.buffer);
    const mime = sniff?.mime;
    if (!mime || !ALLOWED_MIME.has(mime)) {
      throw new AppError("ATTACHMENT_TYPE_NOT_ALLOWED", { detected: mime ?? null });
    }
    const id = ids.next();
    const safe = sanitise(f.originalName);
    const storedPath = join(ideaDir, `${id}__${safe}`);
    await new Promise<void>((resolve, reject) => {
      const out = createWriteStream(storedPath);
      Readable.from(f.buffer).pipe(out).on("finish", resolve).on("error", reject);
    });
    const sz = statSync(storedPath).size;
    rows.push({
      id,
      ideaId,
      uploaderId: actor.id,
      originalName: f.originalName,
      storedPath,
      mimeType: mime,
      sizeBytes: sz,
      uploadedAt: clock.now().getTime(),
      displayOrder: existing.length + i,
    });
  }

  await insertBatch(rows);
  for (const r of rows) {
    logSecurityEvent({
      event: "attachment_added",
      userId: actor.id,
      actorRole: actor.role,
      ip: null,
      requestId: null,
      details: { ideaId, attachmentId: r.id, sizeBytes: r.sizeBytes, mimeType: r.mimeType },
    });
  }

  return rows.map((r) => toSummary({ ...r, ideaId: r.ideaId }));
}

/**
 * Phase 5 — Reorders the attachment list for an idea. `orderedIds`
 * must equal the current set exactly; otherwise `ATTACHMENT_ORDER_INVALID`.
 */
export async function reorderAttachments(args: {
  ideaId: string;
  orderedIds: string[];
  actor: { id: string; role: Role };
}): Promise<void> {
  await loadOwnedIdeaForEdit(args.ideaId, args.actor);
  const existing = await listByIdeaOrdered(args.ideaId);
  const have = new Set(existing.map((e) => e.id));
  const got = new Set(args.orderedIds);
  if (
    args.orderedIds.length !== existing.length ||
    args.orderedIds.length !== got.size ||
    [...got].some((id) => !have.has(id))
  ) {
    throw new AppError("ATTACHMENT_ORDER_INVALID");
  }
  await reorderRepo(args.ideaId, args.orderedIds);
  logSecurityEvent({
    event: "attachment_reordered",
    userId: args.actor.id,
    actorRole: args.actor.role,
    ip: null,
    requestId: null,
    details: { ideaId: args.ideaId, orderedIds: args.orderedIds },
  });
}

/**
 * Phase 5 — Removes a single attachment from an idea (author + state guard).
 */
export async function removeAttachment(args: {
  attachmentId: string;
  actor: { id: string; role: Role };
}): Promise<void> {
  const att = await findAttachmentById(args.attachmentId);
  if (!att) throw AppError.notFound("ATTACHMENT_NOT_FOUND");
  if (!att.ideaId) throw new AppError("ATTACHMENT_FORBIDDEN");
  await loadOwnedIdeaForEdit(att.ideaId, args.actor);
  await deleteAttachmentRepo(args.attachmentId);
  try {
    unlinkSync(att.storedPath);
  } catch {
    // tolerate already-missing files
  }
  logSecurityEvent({
    event: "attachment_removed",
    userId: args.actor.id,
    actorRole: args.actor.role,
    ip: null,
    requestId: null,
    details: { ideaId: att.ideaId, attachmentId: att.id },
  });
}

/**
 * Phase 5 — Lists attachments visible to the viewer. Author always
 * sees their own; reviewers/admins see every idea's attachments.
 */
export async function listForIdea(args: {
  ideaId: string;
  viewer: { id: string; role: Role };
}): Promise<AttachmentSummary[]> {
  const idea = await findIdeaById(args.ideaId);
  if (!idea) throw AppError.notFound("IDEA_NOT_FOUND");
  const canRead =
    idea.authorId === args.viewer.id ||
    args.viewer.role === "EVALUATOR" ||
    args.viewer.role === "ADMIN";
  if (!canRead) throw new AppError("ATTACHMENT_FORBIDDEN");
  const rows = await listByIdeaOrdered(args.ideaId);
  return rows.map((r) => toSummary(r as never));
}
