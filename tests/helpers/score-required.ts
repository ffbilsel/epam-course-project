import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { ideas } from "@/db/schema";
import { listDimensionsForCategory } from "@/db/repositories/dimension-repo";
import { putRatings } from "@/server/rating-service";

/**
 * Phase 4 / 005 polish — scores every required rating dimension for
 * an idea so an evaluator can call `applyTransition(..., "APPROVE")`
 * without tripping `RATING_REQUIRED_MISSING`. Each required score
 * defaults to `4`. Used from integration tests that pre-date the
 * rating gate.
 */
export async function scoreRequiredForApprove(ideaId: string, evaluator: string): Promise<void> {
  const idea = (
    await db
      .select()
      .from(ideas)
      .where(sql`${ideas.id} = ${ideaId}`)
      .limit(1)
  )[0];
  if (!idea) throw new Error(`scoreRequiredForApprove: idea ${ideaId} not found`);
  const dims = await listDimensionsForCategory(idea.categoryId!);
  const required = dims.filter((d) => d.required === 1);
  if (required.length === 0) return;
  await putRatings(
    ideaId,
    { id: evaluator, role: "EVALUATOR" },
    { scores: required.map((d) => ({ dimensionId: d.id, score: 4 })) },
  );
}
