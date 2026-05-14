import { and, desc, eq, gte, inArray, like, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  categories,
  ideas,
  statusTransitions,
  users,
  type IdeaStatus,
  type Role,
} from "@/db/schema";
import { AppError } from "@/lib/errors/AppError";
import { formatCsvRow } from "@/lib/format/csv";
import { logSecurityEvent } from "@/server/infra/logger";
import type { ListingQuery } from "@/lib/validation/idea";
import { buildListingPredicate } from "@/server/idea-listing";
import { type ListingPredicate } from "@/db/repositories/idea-repo";

/** Columns of one CSV row, in the order they appear in the file. */
export interface IdeaExportRow {
  id: string;
  title: string;
  status: IdeaStatus;
  category: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
  latestDecisionAt: string;
  latestDecisionActor: string;
  latestDecisionComment: string;
}

const HEADER: readonly string[] = [
  "id",
  "title",
  "status",
  "category",
  "author_email",
  "created_at",
  "updated_at",
  "latest_decision_at",
  "latest_decision_actor",
  "latest_decision_comment",
];

const BATCH_SIZE = 500;
const DECISION_STATUSES = new Set<IdeaStatus>(["APPROVED", "REJECTED", "IMPLEMENTED"]);

/**
 * Streams the current filter set as an RFC 4180 CSV.
 *
 * Admin-only (ADR-0016). Reuses the listing predicate so the export
 * mirrors the on-screen filters exactly, then for each batch of 500
 * rows pulls the latest decision row from `status_transitions`.
 * Logs one `idea_export` security event with the filter snapshot
 * and the streamed row count.
 */
export async function streamIdeasCsv(
  query: ListingQuery,
  actor: { id: string; role: Role; ip?: string | null; requestId?: string | null },
): Promise<ReadableStream<Uint8Array>> {
  if (actor.role !== "ADMIN") {
    throw new AppError("AUTH_FORBIDDEN_ROLE");
  }
  // Admin export is always cross-tenant; the UI passes scope=all
  // but we re-pin it here so the predicate cannot be narrowed by a
  // crafted URL (e.g. scope=mine for a different user).
  const predicate = buildListingPredicate(
    { ...query, scope: "all" },
    { id: actor.id, role: actor.role },
  );

  const encoder = new TextEncoder();
  let rowsWritten = 0;
  let offset = 0;
  let finished = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(encoder.encode(formatCsvRow(HEADER)));
    },
    // eslint-disable-next-line complexity -- linear state machine over batch/finished/exhausted branches
    async pull(controller) {
      if (finished) {
        controller.close();
        return;
      }
      const batch = await fetchBatch(predicate, offset, BATCH_SIZE);
      if (batch.length === 0) {
        finished = true;
        logSecurityEvent({
          event: "idea_export",
          userId: actor.id,
          actorRole: actor.role,
          ip: actor.ip ?? null,
          requestId: actor.requestId ?? null,
          details: { rowCount: rowsWritten, filters: snapshotFilters(query) },
        });
        controller.close();
        return;
      }
      const decisionByIdea = await fetchLatestDecisions(batch.map((r) => r.id));
      for (const row of batch) {
        const decision = decisionByIdea.get(row.id);
        controller.enqueue(
          encoder.encode(
            formatCsvRow([
              row.id,
              row.title,
              row.status,
              row.category,
              row.authorEmail,
              new Date(row.createdAt).toISOString(),
              new Date(row.updatedAt).toISOString(),
              decision ? new Date(decision.recordedAt).toISOString() : "",
              decision?.actorName ?? "",
              decision?.comment ?? "",
            ]),
          ),
        );
        rowsWritten++;
      }
      offset += batch.length;
      if (batch.length < BATCH_SIZE) {
        finished = true;
        logSecurityEvent({
          event: "idea_export",
          userId: actor.id,
          actorRole: actor.role,
          ip: actor.ip ?? null,
          requestId: actor.requestId ?? null,
          details: { rowCount: rowsWritten, filters: snapshotFilters(query) },
        });
        controller.close();
      }
    },
  });
  return stream;
}

interface ExportBatchRow {
  id: string;
  title: string;
  status: IdeaStatus;
  category: string;
  authorEmail: string;
  createdAt: number;
  updatedAt: number;
}

async function fetchBatch(
  filter: ListingPredicate,
  offset: number,
  limit: number,
): Promise<ExportBatchRow[]> {
  const where = buildWhereFromPredicate(filter);
  const rows = await db
    .select({
      id: ideas.id,
      title: ideas.title,
      status: ideas.status,
      category: categories.name,
      authorEmail: users.email,
      createdAt: ideas.createdAt,
      updatedAt: ideas.updatedAt,
    })
    .from(ideas)
    .innerJoin(categories, eq(ideas.categoryId, categories.id))
    .innerJoin(users, eq(ideas.authorId, users.id))
    .where(where)
    .orderBy(desc(ideas.createdAt), ideas.id)
    .limit(limit)
    .offset(offset);
  return rows as ExportBatchRow[];
}

interface DecisionRow {
  recordedAt: number;
  actorName: string;
  comment: string | null;
}

async function fetchLatestDecisions(ideaIds: string[]): Promise<Map<string, DecisionRow>> {
  if (ideaIds.length === 0) return new Map();
  const rows = await db
    .select({
      ideaId: statusTransitions.ideaId,
      recordedAt: statusTransitions.recordedAt,
      actorName: users.displayName,
      comment: statusTransitions.comment,
      toState: statusTransitions.toState,
    })
    .from(statusTransitions)
    .innerJoin(users, eq(users.id, statusTransitions.actorId))
    .where(
      and(
        inArray(statusTransitions.ideaId, ideaIds),
        ne(statusTransitions.fromState, statusTransitions.toState),
      ),
    )
    .orderBy(desc(statusTransitions.recordedAt));

  const out = new Map<string, DecisionRow>();
  for (const r of rows) {
    if (!DECISION_STATUSES.has(r.toState as IdeaStatus)) continue;
    if (out.has(r.ideaId)) continue;
    out.set(r.ideaId, {
      recordedAt: r.recordedAt,
      actorName: r.actorName,
      comment: r.comment ?? null,
    });
  }
  return out;
}

// Mirrors src/db/repositories/idea-repo.ts#buildPredicate. Kept in
// a separate module-private helper so the export path can build a
// where-clause without depending on Drizzle internals there.
// eslint-disable-next-line complexity -- one branch per optional filter dimension
function buildWhereFromPredicate(filter: ListingPredicate) {
  const conds: ReturnType<typeof eq>[] = [];
  if (filter.authorScope) conds.push(eq(ideas.authorId, filter.authorScope));
  const allowedStatuses = filter.statusWhitelist
    ? filter.status
      ? filter.status.filter((s) => filter.statusWhitelist!.includes(s))
      : filter.statusWhitelist
    : filter.status;
  if (allowedStatuses && allowedStatuses.length > 0) {
    conds.push(inArray(ideas.status, allowedStatuses as IdeaStatus[]));
  }
  if (filter.categoryId) conds.push(eq(ideas.categoryId, filter.categoryId));
  if (filter.q && filter.q.length > 0) {
    const needle = `%${filter.q.toLowerCase()}%`;
    conds.push(
      or(
        sql`lower(${ideas.title}) LIKE ${needle}`,
        sql`lower(${ideas.description}) LIKE ${needle}`,
      ) as ReturnType<typeof eq>,
    );
  }
  if (filter.from) {
    const fromTs = Date.UTC(
      Number(filter.from.slice(0, 4)),
      Number(filter.from.slice(5, 7)) - 1,
      Number(filter.from.slice(8, 10)),
    );
    conds.push(gte(ideas.createdAt, fromTs));
  }
  if (filter.to) {
    const toTs = Date.UTC(
      Number(filter.to.slice(0, 4)),
      Number(filter.to.slice(5, 7)) - 1,
      Number(filter.to.slice(8, 10)),
      23,
      59,
      59,
      999,
    );
    conds.push(lte(ideas.createdAt, toTs));
  }
  return conds.length === 0 ? undefined : and(...conds);
}

function snapshotFilters(q: ListingQuery): Record<string, unknown> {
  const snap: Record<string, unknown> = { scope: "all" };
  if (q.q) snap["q"] = q.q;
  if (q.categoryId) snap["categoryId"] = q.categoryId;
  if (q.status && q.status.length > 0) snap["status"] = q.status;
  if (q.from) snap["from"] = q.from;
  if (q.to) snap["to"] = q.to;
  return snap;
}
