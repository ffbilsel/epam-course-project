import { withTx } from "@/db/client";
import { AppError } from "@/lib/errors/AppError";
import {
  findCategoryById,
  findCategoryByLowerName,
  insertProposedCategory,
  decideCategory,
  findOtherCategoryId,
  readSchema,
  writeSchema,
} from "@/db/repositories/category-repo";
import { relinkCategory } from "@/db/repositories/idea-repo";
import { logSecurityEvent } from "@/server/infra/logger";
import { SystemClock, type Clock } from "@/server/infra/clock";
import { SystemIdGenerator, type IdGenerator } from "@/server/infra/id-generator";
import { validateSchema } from "@/server/category-schema";
import type { CategoryFieldDefinition } from "@/lib/validation/category-fields";
import type { Role } from "@/db/schema";

/**
 * Proposes a new category by name. Any authenticated user can call
 * this; the category lands in `PROPOSED` state and waits for an
 * Admin decision (see {@link approveCategory} / {@link rejectCategory}).
 *
 * Throws `CATEGORY_NAME_TAKEN` (409) if a category with the same
 * case-insensitive name already exists in any state.
 */
export async function proposeCategory(
  name: string,
  proposerId: string,
  proposerRole: Role,
  deps: { clock?: Clock; ids?: IdGenerator } = {},
): Promise<{ id: string; name: string; state: "PROPOSED" }> {
  const clock = deps.clock ?? SystemClock;
  const ids = deps.ids ?? SystemIdGenerator;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 40) {
    throw new AppError("IDEA_CATEGORY_INVALID");
  }
  const dup = await findCategoryByLowerName(trimmed);
  if (dup) throw AppError.conflict("CATEGORY_NAME_TAKEN");
  const id = ids.next();
  const now = clock.now().getTime();
  await insertProposedCategory({
    id,
    name: trimmed,
    state: "PROPOSED",
    proposedById: proposerId,
    decidedById: null,
    decidedAt: null,
    createdAt: now,
    isProtected: 0,
  });
  logSecurityEvent({
    event: "category_proposed",
    userId: proposerId,
    actorRole: proposerRole,
    ip: null,
    requestId: null,
    details: { categoryId: id, name: trimmed },
  });
  return { id, name: trimmed, state: "PROPOSED" };
}

/**
 * Approves a PROPOSED category (FR-016). Admin-only.
 */
export async function approveCategory(
  categoryId: string,
  adminId: string,
  deps: { clock?: Clock } = {},
): Promise<void> {
  const cat = await findCategoryById(categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");
  if (cat.state !== "PROPOSED") throw AppError.conflict("CATEGORY_NOT_PENDING");
  const now = (deps.clock ?? SystemClock).now().getTime();
  await decideCategory(categoryId, "ACTIVE", adminId, now);
  logSecurityEvent({
    event: "category_decision",
    userId: adminId,
    actorRole: "ADMIN",
    ip: null,
    requestId: null,
    details: { categoryId, decision: "APPROVE" },
  });
}

/**
 * Rejects a PROPOSED category and re-links every associated idea to
 * the protected `Other` category in one tx.
 */
export async function rejectCategory(
  categoryId: string,
  adminId: string,
  deps: { clock?: Clock } = {},
): Promise<void> {
  const cat = await findCategoryById(categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");
  if (cat.isProtected) throw AppError.conflict("CATEGORY_PROTECTED");
  if (cat.state !== "PROPOSED") throw AppError.conflict("CATEGORY_NOT_PENDING");
  const otherId = await findOtherCategoryId();
  const now = (deps.clock ?? SystemClock).now().getTime();
  withTx(() => {
    void relinkCategory(categoryId, otherId, now);
    void decideCategory(categoryId, "REJECTED", adminId, now);
  });
  logSecurityEvent({
    event: "category_decision",
    userId: adminId,
    actorRole: "ADMIN",
    ip: null,
    requestId: null,
    details: { categoryId, decision: "REJECT", relinkedTo: otherId },
  });
}

/**
 * Reads the live structured-field schema for a category (Phase 2).
 * Read-only; usable by any authenticated caller.
 */
export async function getCategorySchema(categoryId: string): Promise<CategoryFieldDefinition[]> {
  return readSchema(categoryId);
}

/**
 * Replaces the structured-field schema for an `ACTIVE` category.
 * Admin-only (caller-enforced via `requireRole("ADMIN")`).
 * Validates `input` through `CategoryFieldSchema`. Never mutates
 * any existing `ideas.category_answers` (FR-010 / ADR-0010).
 */
export async function saveCategorySchema(
  categoryId: string,
  input: unknown,
  adminId: string,
): Promise<CategoryFieldDefinition[]> {
  const cat = await findCategoryById(categoryId);
  if (!cat) throw AppError.notFound("CATEGORY_NOT_FOUND");
  if (cat.state !== "ACTIVE") throw AppError.conflict("CATEGORY_NOT_ACTIVE");
  const fields = validateSchema(input);
  await writeSchema(categoryId, fields);
  logSecurityEvent({
    event: "category_schema_update",
    userId: adminId,
    actorRole: "ADMIN",
    ip: null,
    requestId: null,
    details: { categoryId, fieldCount: fields.length },
  });
  return fields;
}
