import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";

/**
 * Resolves the SQLite file path from `DATABASE_URL` (defaulting to
 * `./data/innovatepam.db`) and ensures the parent directory exists.
 */
function resolveDbPath(): string {
  const raw = process.env["DATABASE_URL"] ?? "file:./data/innovatepam.db";
  const path = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  mkdirSync(dirname(path), { recursive: true });
  return path;
}

const dbPath = resolveDbPath();
const sqlite = new Database(dbPath);
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("journal_mode = WAL");

/**
 * Singleton Drizzle client backed by `better-sqlite3`.
 */
export const db = drizzle(sqlite, { schema });
/**
 * Direct access to the underlying `better-sqlite3` instance.
 */
export const sqliteClient = sqlite;

/**
 * Runs `fn` inside a single SQLite transaction.
 */
export function withTx<T>(fn: (tx: typeof db) => T): T {
  return sqlite.transaction(() => fn(db))();
}
