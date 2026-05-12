import { withTx } from "@/db/client";
import { AppError } from "@/lib/errors/AppError";
import {
  findCategoryById,
  decideCategory,
  findOtherCategoryId,
} from "@/db/repositories/category-repo";
import { relinkCategory } from "@/db/repositories/idea-repo";
import { logSecurityEvent } from "@/server/infra/logger";
import { SystemClock, type Clock } from "@/server/infra/clock";

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
