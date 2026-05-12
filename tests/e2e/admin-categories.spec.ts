import { test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./axe";

/**
 * T077 — US4: Admin reviews proposed categories.
 *
 * Signs in as bootstrap admin, opens /admin/categories, asserts axe
 * clean, and approves the first PROPOSED row if present. The
 * REJECT-relinks-to-Other path is covered in the integration suite.
 */
test("US4: admin can browse proposed categories and approve one", async ({ page }) => {
  const adminEmail = process.env["E2E_ADMIN_EMAIL"] ?? "admin@innovatepam.test";
  const adminPassword = process.env["E2E_ADMIN_PASSWORD"] ?? "Passw0rd!2024";

  await page.goto("/login");
  await page.getByLabel(/email/i).fill(adminEmail);
  await page.getByLabel(/password/i).fill(adminPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(queue|my-ideas|admin)/);

  await page.goto("/admin/categories");
  await expectNoSeriousAxeViolations(page);

  const approve = page.getByRole("button", { name: /^approve$/i }).first();
  if ((await approve.count()) > 0) {
    await approve.click();
  }
});
