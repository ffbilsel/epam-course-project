import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "list",
  use: {
    baseURL: process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000",
    trace: "on-first-retry",
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
    timeout: 120_000,
    env: {
      NEXTAUTH_SECRET: process.env["NEXTAUTH_SECRET"] ?? "ci-test-secret",
      NEXTAUTH_URL: process.env["NEXTAUTH_URL"] ?? "http://localhost:3000",
      DATABASE_URL: process.env["DATABASE_URL"] ?? "file:./data/innovatepam.db",
      BOOTSTRAP_ADMIN_EMAIL: process.env["BOOTSTRAP_ADMIN_EMAIL"] ?? "admin@innovatepam.test",
    },
  },
});
