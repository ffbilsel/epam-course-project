import type { Page } from "@playwright/test";

/**
 * Sign in via the NextAuth credentials API directly, then attach
 * the resulting session cookie to the browser context. This avoids
 * the flaky click → navigation → cookie race observed in CI when
 * driving the login form through the UI.
 */
export async function signInAs(page: Page, email: string, password: string): Promise<void> {
  // 1. Fetch a CSRF token (also seeds the csrf cookie).
  const csrfRes = await page.request.get("/api/auth/csrf");
  if (!csrfRes.ok()) {
    throw new Error(`csrf fetch failed: HTTP ${csrfRes.status()}`);
  }
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };

  // 2. POST credentials with redirect=false so the response is JSON.
  const cbRes = await page.request.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email,
      password,
      callbackUrl: "/",
      redirect: "false",
      json: "true",
    },
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
  if (!cbRes.ok()) {
    throw new Error(`credentials callback failed: HTTP ${cbRes.status()}`);
  }

  // 3. Sanity check the session is now active.
  const sessionRes = await page.request.get("/api/auth/session");
  const session = (await sessionRes.json()) as { user?: { email?: string } };
  if (!session?.user?.email) {
    throw new Error(`no session established for ${email}`);
  }
}
