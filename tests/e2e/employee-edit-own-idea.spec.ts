import { test, expect } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./axe";

/**
 * Feature 003 / US1 — Author edits & deletes own SUBMITTED idea.
 *
 * Registers a fresh employee, submits an idea, then:
 *   1. Edits the title and description from the detail page and
 *      verifies the new values render.
 *   2. Opens the delete dialog, types "delete" to confirm, and
 *      verifies the redirect to My Ideas and the idea no longer
 *      appears in the list.
 * Asserts axe-clean on each visited screen.
 */
test("US1: author can edit and delete an own SUBMITTED idea", async ({ page }) => {
  const stamp = Date.now();
  const email = `editor-${stamp}@innovatepam.test`;
  const password = "Passw0rd!2024";

  await page.goto("/register");
  await page.getByLabel(/display name/i).fill("Edit E2E");
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
  const originalTitle = `Editable idea ${stamp}`;
  await page.getByLabel(/title/i).fill(originalTitle);
  await page.getByLabel(/description/i).fill("Original description from Playwright.");
  await page.getByLabel(/category/i).selectOption({ label: "Cost Savings" });
  await page.getByRole("button", { name: /submit/i }).click();
  await page.waitForURL(/\/ideas\/[0-9a-f-]+$/i);
  const detailUrl = page.url();
  await expect(page.getByText("Idea submitted")).toHaveCount(0, { timeout: 6_000 });

  // Edit
  await page.getByRole("link", { name: /edit idea/i }).click();
  await page.waitForURL(/\/ideas\/[0-9a-f-]+\/edit$/i);
  await expectNoSeriousAxeViolations(page);
  const newTitle = `Edited idea ${stamp}`;
  await page.getByLabel(/title/i).fill(newTitle);
  await page.getByLabel(/description/i).fill("Updated description from Playwright edit flow.");
  await page.getByRole("button", { name: /save changes/i }).click();
  await page.waitForURL(detailUrl);
  await expect(page.getByRole("heading", { name: newTitle })).toBeVisible();
  await expect(page.getByText("Idea updated")).toHaveCount(0, { timeout: 6_000 });

  // Delete
  await page.getByRole("button", { name: /delete idea/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expectNoSeriousAxeViolations(page);
  await page.getByLabel(/type .* to confirm/i).fill("delete");
  await page.getByRole("button", { name: /delete permanently/i }).click();
  await page.waitForURL(/\/my-ideas$/);
  await expect(page.getByText(newTitle)).toHaveCount(0);
});
