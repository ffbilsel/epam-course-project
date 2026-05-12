/* eslint-disable no-console */
/**
 * Playwright global setup: ensures the e2e DB exists, has the
 * canonical seed categories, and contains the bootstrap admin
 * account that all admin-flavoured specs sign in as. Runs once
 * before the Playwright webServer starts.
 *
 * Idempotent — safe to re-run on repeated local invocations.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";

const ADMIN_EMAIL = process.env["E2E_ADMIN_EMAIL"] ?? "admin@innovatepam.test";
const ADMIN_PASSWORD = process.env["E2E_ADMIN_PASSWORD"] ?? "Passw0rd!2024";

function run(label: string, args: string[], extraEnv: Record<string, string> = {}): void {
  const env = { ...process.env, ...extraEnv } as NodeJS.ProcessEnv;
  const result = spawnSync(process.execPath, args, {
    env,
    stdio: "inherit",
    cwd: path.resolve(__dirname, "..", ".."),
    shell: false,
  });
  if (result.status !== 0) {
    throw new Error(`[e2e setup] ${label} failed (exit ${result.status ?? "null"})`);
  }
}

function tsxBin(): string {
  // Resolve the local tsx CLI so we don't depend on PATH.
  return require.resolve("tsx/cli");
}

export default async function globalSetup(): Promise<void> {
  console.log("[e2e setup] running migrations + seed + bootstrap admin");
  const tsx = tsxBin();
  run("db:migrate", [tsx, "src/db/migrate.ts"]);
  run("db:seed", [tsx, "src/db/seed.ts"]);
  run("db:seed:admin", [tsx, "scripts/seed-admin.ts"], {
    BOOTSTRAP_ADMIN_EMAIL: ADMIN_EMAIL,
    BOOTSTRAP_ADMIN_PASSWORD: ADMIN_PASSWORD,
  });
}
