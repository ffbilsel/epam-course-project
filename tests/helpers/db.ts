import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/db/schema";

/**
 * Returns a freshly-migrated, isolated Drizzle DB rooted in a temp
 * directory. Caller MUST invoke {@link cleanupTestDb} when done.
 */
export function createTestDb(): {
  db: ReturnType<typeof drizzle<typeof schema>>;
  sqlite: Database.Database;
  dir: string;
} {
  const dir = mkdtempSync(join(tmpdir(), "innovatepam-"));
  const sqlite = new Database(join(dir, "test.db"));
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: "./drizzle" });
  return { db, sqlite, dir };
}

/**
 * Closes the test database and removes its temp directory.
 */
export function cleanupTestDb(handle: { sqlite: Database.Database; dir: string }): void {
  try {
    handle.sqlite.close();
  } catch {
    /* ignore */
  }
  try {
    rmSync(handle.dir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
}
