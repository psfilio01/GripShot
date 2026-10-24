import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

/**
 * E2E: Workflow bundle-download and template features.
 *
 * Requires E2E_EMAIL + E2E_PASSWORD and at least one completed workflow in the
 * test account. Skips gracefully when credentials are absent.
 */
test.describe("Workflow bundle download & templates (authenticated)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("workflows list shows 'From template' button", async ({ page }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests.",
    );

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");

    await expect(
      page.getByRole("button", { name: /from template/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("'From template' modal opens and lists templates or shows empty state", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests.",
    );

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");

    await page.getByRole("button", { name: /from template/i }).click();
    await expect(
      page.getByRole("heading", { name: /from template|create from template/i }),
    ).toBeVisible({ timeout: 10_000 });

    // Should either show a select or an empty-state message
    const hasSelect = await page.locator("select").count() > 0;
    const hasEmpty = await page.getByText(/no templates yet/i).count() > 0;
    expect(hasSelect || hasEmpty).toBe(true);
  });

  test("workflow detail shows 'Save as template' button when steps exist", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests.",
    );

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");

    // Open first workflow that has steps (has a steps-progress label)
    const firstWithSteps = page.locator("a").filter({
      has: page.locator("span").filter({ hasText: /\d+\/\d+ generated/ }),
    }).first();

    const count = await firstWithSteps.count();
    if (count === 0) {
      test.skip(true, "No workflows with steps found in test account.");
      return;
    }

    await firstWithSteps.click();
    await expect(
      page.getByRole("button", { name: /save as template/i }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("bundle download button is visible when all steps are completed and triggers download", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests.",
    );

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");

    // Find a completed workflow
    const completedLink = page.locator("a").filter({
      has: page.locator("span").filter({ hasText: /completed/i }),
    }).first();

    const count = await completedLink.count();
    if (count === 0) {
      test.skip(true, "No completed workflows found in test account.");
      return;
    }

    await completedLink.click();

    // The "Download bundle" button should be visible
    const downloadBtn = page.getByRole("button", {
      name: /download bundle/i,
    });
    await expect(downloadBtn).toBeVisible({ timeout: 20_000 });

    // Click and verify a download is initiated (browser fires a download event)
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 30_000 }),
      downloadBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.zip$/);
  });
});
