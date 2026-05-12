import { test, expect } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./axe";

/**
 * T038 — US1: Employee submits an idea end-to-end.
 *
 * Registers a fresh employee, signs in, submits an idea against the
 * seeded "Process Improvement" category, and verifies it appears in
 * "My Ideas". Asserts axe-clean on each visited screen.
 */
test("US1: employee can register, sign in, and submit an idea", async ({ page }) => {
  const stamp = Date.now();
  const email = `employee-${stamp}@innovatepam.test`;
  const password = "Passw0rd!2024";

  await page.goto("/register");
  await expectNoSeriousAxeViolations(page);
  await page.getByLabel(/display name/i).fill("Submit E2E");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /create account/i }).click();

  await page.waitForURL(/\/(my-ideas|login)/);
  if (page.url().includes("/login")) {
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL(/\/my-ideas/);
  }

  await page.goto("/ideas/new");
  await expectNoSeriousAxeViolations(page);
  await page.getByLabel(/title/i).fill(`E2E idea ${stamp}`);
  await page.getByLabel(/description/i).fill("Submitted via Playwright happy path.");
  await page.getByLabel(/category/i).selectOption({ label: "Process Improvement" });
  await page.getByRole("button", { name: /submit/i }).click();

  await page.waitForURL(/\/my-ideas/);
  await expect(page.getByText(`E2E idea ${stamp}`)).toBeVisible();
  await expectNoSeriousAxeViolations(page);
});
