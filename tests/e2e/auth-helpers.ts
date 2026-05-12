import type { Page } from "@playwright/test";

/**
 * Sign in via the credentials form, retrying once if the form
 * lands back on /login (an occasional CI flake when the session
 * cookie / redirect hand-off is slow).
 */
export async function signInAs(
  page: Page,
  email: string,
  password: string,
  expect: RegExp = /\/(queue|my-ideas|admin|ideas)/,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/login") || /error=/.test(url.search), {
    timeout: 30_000,
  });
  if (page.url().includes("/login")) {
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 30_000 });
  }
  await page.waitForURL(expect, { timeout: 30_000 });
}
