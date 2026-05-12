import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Vitest globalSetup — picks a fresh per-process SQLite path under
 * the OS tmp dir, runs migrations + seeds, and exposes the path via
 * env. Each integration test file then truncates dynamic tables in
 * `beforeEach` for isolation.
 */
export default async function setup(): Promise<() => void> {
  const dir = mkdtempSync(join(tmpdir(), "innovatepam-itest-"));
  const dbPath = join(dir, "test.db");
  process.env["DATABASE_URL"] = `file:${dbPath}`;
  process.env["NEXTAUTH_SECRET"] = "test-secret-test-secret-test-secret";
  // Run migration + seed via tsx so that the singleton client picks
  // up our env var when the test files import @/db/client.
  execSync(`npx tsx src/db/migrate.ts`, { stdio: "inherit", env: process.env });
  execSync(`npx tsx src/db/seed.ts`, { stdio: "inherit", env: process.env });
  return () => {
    /* leave temp dir for inspection */
  };
}
