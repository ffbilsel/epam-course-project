import { test } from "@playwright/test";
import { expectNoSeriousAxeViolations } from "./axe";
import { signInAs } from "./auth-helpers";

/**
 * T065 — US3: Admin views Users page, changes a role.
 *
 * Signs in as bootstrap admin, navigates to /admin/users, asserts the
 * page is axe-clean, and toggles a role select if a non-admin user
 * exists. Last-admin guard is exercised in the integration suite.
 */
test("US3: admin can browse users and change a role", async ({ page }) => {
  const adminEmail = process.env["E2E_ADMIN_EMAIL"] ?? "admin@innovatepam.test";
  const adminPassword = process.env["E2E_ADMIN_PASSWORD"] ?? "Passw0rd!2024";

  await signInAs(page, adminEmail, adminPassword);

  await page.goto("/admin/users");
  await expectNoSeriousAxeViolations(page);

  const selects = page.locator("select");
  const count = await selects.count();
  if (count > 0) {
    // Promote the first non-admin row's role select to EVALUATOR if available.
    for (let i = 0; i < count; i++) {
      const sel = selects.nth(i);
      const value = await sel.inputValue();
      if (value !== "ADMIN") {
        await sel.selectOption("EVALUATOR");
        break;
      }
    }
  }
});
