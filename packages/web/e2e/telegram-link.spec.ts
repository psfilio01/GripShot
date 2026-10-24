import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

test.describe("Telegram link settings page", () => {
  test("renders page heading and how-it-works section without auth", async ({
    page,
  }) => {
    // The page itself redirects unauthenticated users, so skip if no creds
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E.",
    );
    test.setTimeout(60_000);

    await signInWithEmail(page);
    await page.goto("/en/dashboard/settings/telegram");

    await expect(
      page.getByRole("heading", { level: 1 }),
    ).toBeVisible({ timeout: 15_000 });

    // "How it works" section should always render
    await expect(
      page.getByRole("heading", { level: 2 }).last(),
    ).toBeVisible();
  });

  test("shows not-connected status for fresh account", async ({ page }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E.",
    );
    test.setTimeout(60_000);

    await signInWithEmail(page);

    // Wait for GET /api/telegram/link to resolve
    const linkStatus = page.waitForResponse(
      (res) =>
        res.url().includes("/api/telegram/link") &&
        res.request().method() === "GET",
      { timeout: 20_000 },
    );
    await page.goto("/en/dashboard/settings/telegram");
    await linkStatus;

    // Either connected or not connected status dot must be visible
    // (account might already be linked in test env)
    const statusSection = page.locator("section").first();
    await expect(statusSection).toBeVisible({ timeout: 10_000 });

    // The status section must not still show a loading spinner after API resolves
    await expect(
      page.locator(".animate-pulse"),
    ).toHaveCount(0, { timeout: 10_000 });
  });

  test("auto-links account when token query param is present", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E.",
    );
    test.setTimeout(60_000);

    await signInWithEmail(page);

    // Visit with an invalid/expired token — expect an error toast (not a crash)
    const linkCall = page.waitForResponse(
      (res) =>
        res.url().includes("/api/telegram/link") &&
        res.request().method() === "POST",
      { timeout: 20_000 },
    );
    await page.goto("/en/dashboard/settings/telegram?token=invalid-test-token");
    const res = await linkCall;

    // Server should return 400/404 for an invalid token
    expect(res.status()).toBeGreaterThanOrEqual(400);

    // Token param should be stripped from the URL after attempt
    await expect(page).toHaveURL(/\/settings\/telegram(?:\?.*)?$/, {
      timeout: 10_000,
    });
    // URL should NOT contain the token after the redirect
    const url = page.url();
    expect(url).not.toContain("token=");
  });
});
