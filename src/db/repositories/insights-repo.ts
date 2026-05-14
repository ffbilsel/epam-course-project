import { sqliteClient } from "@/db/client";

/* eslint-disable jsdoc/require-jsdoc */

/**
 * Raw row returned by {@link querySubmissionsByDay} — one row per
 * UTC day in `[fromMs, toMs)` that had at least one submitted idea.
 */
export interface DailyCountRow {
  bucket: string;
  count: number;
}

/**
 * Returns the count of `ideas.createdAt` per UTC day in
 * `[fromMs, toMs)`. The service layer rolls these into week / month
 * buckets in pure code; SQLite stays simple.
 */
export function querySubmissionsByDay(fromMs: number, toMs: number): DailyCountRow[] {
  const stmt = sqliteClient.prepare(
    `SELECT strftime('%Y-%m-%d', created_at / 1000, 'unixepoch') AS bucket,
            COUNT(*) AS count
     FROM ideas
     WHERE created_at >= ? AND created_at < ?
     GROUP BY bucket
     ORDER BY bucket ASC`,
  );
  const rows = stmt.all(fromMs, toMs) as Array<{ bucket: string; count: number }>;
  return rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));
}

/**
 * Row returned by {@link queryStatusCounts} — count of ideas per
 * status whose `createdAt` falls inside the window.
 */
export interface StatusCountRow {
  status: string;
  count: number;
}

/**
 * Returns the count of ideas per status created inside the window.
 * Used by the approval-rate KPI.
 */
export function queryStatusCounts(fromMs: number, toMs: number): StatusCountRow[] {
  const stmt = sqliteClient.prepare(
    `SELECT status, COUNT(*) AS count
     FROM ideas
     WHERE created_at >= ? AND created_at < ?
     GROUP BY status`,
  );
  const rows = stmt.all(fromMs, toMs) as Array<{ status: string; count: number }>;
  return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
}

/**
 * Row returned by {@link queryCategoryDistribution} — count of
 * ideas per ACTIVE category submitted inside the window.
 */
export interface CategoryCountRow {
  categoryId: string;
  categoryName: string;
  count: number;
}

/**
 * Joins ideas → categories so the chart can show category names.
 * Only ACTIVE categories are returned (PROPOSED / REJECTED are out
 * of scope per FR-029).
 */
export function queryCategoryDistribution(fromMs: number, toMs: number): CategoryCountRow[] {
  const stmt = sqliteClient.prepare(
    `SELECT c.id AS categoryId, c.name AS categoryName, COUNT(i.id) AS count
     FROM categories c
     LEFT JOIN ideas i
       ON i.category_id = c.id
      AND i.created_at >= ?
      AND i.created_at < ?
     WHERE c.state = 'ACTIVE'
     GROUP BY c.id, c.name
     ORDER BY count DESC, c.name ASC`,
  );
  const rows = stmt.all(fromMs, toMs) as Array<{
    categoryId: string;
    categoryName: string;
    count: number;
  }>;
  return rows.map((r) => ({
    categoryId: r.categoryId,
    categoryName: r.categoryName,
    count: Number(r.count),
  }));
}
