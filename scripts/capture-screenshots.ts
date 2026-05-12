/* eslint-disable no-console */
/**
 * Captures presentation screenshots by driving the running dev
 * server (http://localhost:3000) with Playwright Chromium. Saves
 * PNGs into <repoRoot>/screenshots/.
 *
 * NOTE: bypasses the UI sign-in flow by inserting a `sessions` row
 * directly and seeding the corresponding `authjs.session-token`
 * cookie on the browser context. This is required because the
 * combination of Credentials provider + database session strategy
 * is rejected at runtime by `@auth/core` (UnsupportedStrategy).
 */
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import Database from "better-sqlite3";

const BASE = process.env["PLAYWRIGHT_BASE_URL"] ?? "http://localhost:3000";
const OUT = path.resolve(__dirname, "..", "..", "screenshots");
const DB_PATH = path.resolve(__dirname, "..", "data", "innovatepam.db");

interface DemoUser {
  email: string;
  id: string;
}

function lookupUser(email: string): DemoUser {
  const sqlite = new Database(DB_PATH, { readonly: true });
  try {
    const row = sqlite
      .prepare("SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1")
      .get(email) as { id: string } | undefined;
    if (!row) throw new Error(`user not found: ${email}`);
    return { email, id: row.id };
  } finally {
    sqlite.close();
  }
}

function insertSession(userId: string): string {
  const sqlite = new Database(DB_PATH);
  try {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = Date.now() + 24 * 60 * 60 * 1000;
    sqlite
      .prepare("INSERT INTO sessions (session_token, user_id, expires) VALUES (?, ?, ?)")
      .run(token, userId, expires);
    return token;
  } finally {
    sqlite.close();
  }
}

async function impersonate(ctx: BrowserContext, email: string): Promise<void> {
  // Sign in via the regular UI login form. Requires the dev server
  // to use `session: { strategy: "jwt" }` (Credentials + database
  // session strategy is rejected by @auth/core at runtime).
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`, { timeout: 60_000 });
  await page.locator("#email").fill(email);
  await page.locator("#password").fill("Passw0rd!2024");
  await page.getByRole("button", { name: /sign in/i }).click();
  // Wait for navigation away from /login.
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 60_000 });
  await page.close();
}

async function shoot(page: Page, name: string): Promise<void> {
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log(`  -> ${name}.png`);
}

async function freshContext(): Promise<{
  browser: Awaited<ReturnType<typeof chromium.launch>>;
  ctx: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}

async function captureLogin(): Promise<void> {
  const { browser, ctx, page } = await freshContext();
  await page.goto(`${BASE}/login`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "01-login");
  await page.goto(`${BASE}/register`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "02-register");
  await ctx.close();
  await browser.close();
}

async function captureEmployee(): Promise<void> {
  const { browser, ctx, page } = await freshContext();
  await impersonate(ctx, "employee@innovatepam.test");

  await page.goto(`${BASE}/my-ideas`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "03-employee-my-ideas");

  await page.goto(`${BASE}/ideas/new`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "04-employee-new-idea-empty");

  await page.locator("#title").fill("Adopt async standups for distributed teams");
  await page
    .locator("#description")
    .fill(
      "Replace daily live standups with a structured async thread for teams across 3+ time zones, with optional weekly live syncs.",
    );
  await page.locator("#categoryChoice").selectOption({ label: "Process Improvement" });
  await page.waitForTimeout(800);
  await shoot(page, "05-employee-new-idea-dynamic-fields");

  await page.goto(`${BASE}/my-ideas`);
  await page.waitForLoadState("networkidle");
  const link = page.getByRole("link", { name: /Automate weekly status reports/i }).first();
  await link.click();
  await page.waitForURL(/\/ideas\/[0-9a-f-]+$/i, { timeout: 15000 });
  await page
    .getByRole("heading", { name: /Automate weekly status reports/i })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await shoot(page, "06-employee-idea-detail");

  await ctx.close();
  await browser.close();
}

async function captureReviewer(): Promise<void> {
  const { browser, ctx, page } = await freshContext();
  await impersonate(ctx, "evaluator@innovatepam.test");

  await page.goto(`${BASE}/queue`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "07-reviewer-queue");

  const link = page.getByRole("link", { name: /Self-service Postman/i }).first();
  await link.click();
  await page.waitForURL(/\/ideas\/[0-9a-f-]+$/i, { timeout: 15000 });
  await page
    .getByRole("heading", { name: /Self-service Postman/i })
    .waitFor({ state: "visible", timeout: 15000 });
  await page.waitForLoadState("networkidle");
  await shoot(page, "08-reviewer-idea-detail");

  await ctx.close();
  await browser.close();
}

async function captureAdmin(): Promise<void> {
  const { browser, ctx, page } = await freshContext();
  await impersonate(ctx, "admin@innovatepam.test");

  await page.goto(`${BASE}/admin/users`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "09-admin-users");

  await page.goto(`${BASE}/admin/categories`);
  await page.waitForLoadState("networkidle");
  await shoot(page, "10-admin-categories");

  // Pick the "Process Improvement" row's Edit schema link so the
  // screenshot shows a populated, multi-field schema.
  const editLink = page
    .locator("li", { hasText: /Process Improvement/i })
    .getByRole("link", { name: /^edit schema$/i })
    .first();
  if (await editLink.count()) {
    await editLink.click();
    await page.waitForURL(/\/admin\/categories\/[^/]+\/schema$/i, { timeout: 15000 });
    await page.getByRole("heading", { name: /schema/i }).waitFor({ state: "visible" });
    await page.waitForLoadState("networkidle");
    await shoot(page, "11-admin-category-schema");
  }

  await ctx.close();
  await browser.close();
}

async function main(): Promise<void> {
  await fs.mkdir(OUT, { recursive: true });
  console.log(`Writing screenshots to ${OUT}`);
  await captureLogin();
  await captureEmployee();
  await captureReviewer();
  await captureAdmin();
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
