import { defineConfig, devices } from "@playwright/test";

// Timeouts are env-configurable so an interactive agent run can use lower
// values while CI/production keep the original conservative defaults.
//   PLAYWRIGHT_FAST=1  -> agent profile (short)
//   otherwise          -> production defaults
const FAST = process.env["PLAYWRIGHT_FAST"] === "1";
const TEST_TIMEOUT = Number(process.env["PLAYWRIGHT_TIMEOUT"] ?? (FAST ? 20_000 : 60_000));
const ACTION_TIMEOUT = Number(process.env["PLAYWRIGHT_ACTION_TIMEOUT"] ?? (FAST ? 5_000 : 15_000));
const NAV_TIMEOUT = Number(process.env["PLAYWRIGHT_NAV_TIMEOUT"] ?? (FAST ? 10_000 : 30_000));
const EXPECT_TIMEOUT = Number(process.env["PLAYWRIGHT_EXPECT_TIMEOUT"] ?? (FAST ? 5_000 : 10_000));
const WEBSERVER_TIMEOUT = Number(
  process.env["PLAYWRIGHT_WEBSERVER_TIMEOUT"] ?? (FAST ? 60_000 : 120_000),
);

export default defineConfig({
  testDir: "./tests/e2e",
  testIgnore: ["**/global-setup.ts"],
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 1,
  workers: process.env["CI"] ? 1 : undefined,
  timeout: TEST_TIMEOUT,
  expect: { timeout: EXPECT_TIMEOUT },
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000",
    trace: "on-first-retry",
    actionTimeout: ACTION_TIMEOUT,
    navigationTimeout: NAV_TIMEOUT,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: {
    command: process.env["CI"] ? "npm start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: WEBSERVER_TIMEOUT,
    env: {
      NEXTAUTH_SECRET: process.env["NEXTAUTH_SECRET"] ?? "ci-test-secret",
      AUTH_SECRET: process.env["AUTH_SECRET"] ?? process.env["NEXTAUTH_SECRET"] ?? "ci-test-secret",
      NEXTAUTH_URL: process.env["NEXTAUTH_URL"] ?? "http://localhost:3000",
      AUTH_URL: process.env["AUTH_URL"] ?? process.env["NEXTAUTH_URL"] ?? "http://localhost:3000",
      DATABASE_URL: process.env["DATABASE_URL"] ?? "file:./data/innovatepam.db",
      BOOTSTRAP_ADMIN_EMAIL: process.env["BOOTSTRAP_ADMIN_EMAIL"] ?? "admin@innovatepam.test",
      BOOTSTRAP_ADMIN_PASSWORD: process.env["BOOTSTRAP_ADMIN_PASSWORD"] ?? "Passw0rd!2024",
    },
  },
});
