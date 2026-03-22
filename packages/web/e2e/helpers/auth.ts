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

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: /^Sign in$/i }).click();

  await page.waitForURL(/\/dashboard(\/|$)/, { timeout: 60_000 });
}

export function hasE2eAuthCredentials(): boolean {
  return Boolean(
    process.env.E2E_EMAIL?.trim() && process.env.E2E_PASSWORD,
  );
}
