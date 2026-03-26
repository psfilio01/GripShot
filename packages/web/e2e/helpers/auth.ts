import type { Page } from "@playwright/test";

/**
 * Signs in via the login page using Firebase email/password.
 * Requires `E2E_EMAIL` and `E2E_PASSWORD` in the environment.
 */
export async function signInWithEmail(page: Page): Promise<void> {
  const email = process.env.E2E_EMAIL?.trim();
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error("E2E_EMAIL and E2E_PASSWORD must be set");
  }

  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);

  const sessionOk = page.waitForResponse(
    (res) =>
      res.url().includes("/api/auth/session") &&
      res.request().method() === "POST" &&
      res.status() === 200,
    { timeout: 60_000 },
  );

  await page.getByRole("button", { name: /^Sign in$/i }).click();
  await sessionOk;

  await page.waitForURL(/\/(en|de)\/dashboard(\/|$)/, { timeout: 60_000 });
}

export function hasE2eAuthCredentials(): boolean {
  return Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD,
  );
}
