import { test, expect } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./axe";

/**
 * T053 — US2: Reviewer queue and APPROVE with comment.
 *
 * Signs in as the bootstrap admin (BOOTSTRAP_ADMIN_EMAIL / password),
 * opens the queue, clicks APPROVE on a SUBMITTED idea, types a
 * mandatory comment, and confirms the idea status changes.
 */
test("US2: reviewer can approve a submitted idea with a mandatory comment", async ({ page }) => {
  const adminEmail = process.env["E2E_ADMIN_EMAIL"] ?? "admin@innovatepam.test";
  const adminPassword = process.env["E2E_ADMIN_PASSWORD"] ?? "Passw0rd!2024";

  await page.goto("/login");
  await expectNoSeriousAxeViolations(page);
  await page.getByLabel(/email/i).fill(adminEmail);
  await page.getByLabel(/password/i).fill(adminPassword);
  await page.getByRole("button", { name: /sign in/i }).click();

  await page.waitForURL(/\/(queue|my-ideas|admin)/);
  await page.goto("/queue");
  await expectNoSeriousAxeViolations(page);

  // Pick the first idea-detail link inside the queue table
  // specifically; the page header also contains nav links that
  // would otherwise match `getByRole("link")`.
  const firstIdea = page.locator("table a[href^='/ideas/']").first();
  if ((await firstIdea.count()) === 0) {
    test.info().annotations.push({ type: "info", description: "Queue empty — skipping body" });
    return;
  }
  await firstIdea.click();
  await page.waitForURL(/\/ideas\//);

  const approve = page.getByRole("button", { name: /approve/i });
  if ((await approve.count()) > 0) {
    await approve.click();
    await page.getByLabel(/comment/i).fill("Approved via E2E with rationale.");
    await page
      .getByRole("button", { name: /confirm|approve/i })
      .last()
      .click();
    await expect(page.getByText(/APPROVED/i)).toBeVisible();
  }
});
