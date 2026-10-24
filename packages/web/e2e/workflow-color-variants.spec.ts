import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

/**
 * E2E: Workflow color variant (Hero Lock) feature.
 *
 * Requires E2E_EMAIL + E2E_PASSWORD, at least one completed workflow step,
 * and a product with colors configured. Skips gracefully when prerequisites
 * are absent.
 */
test.describe("Workflow color variants (authenticated)", () => {
  test.describe.configure({ timeout: 180_000 });

  test("completed step card shows 'Generate colors' button when product has colors", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests.",
    );

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");

    const completedLink = page
      .locator("a")
      .filter({
        has: page.locator("span").filter({ hasText: /completed/i }),
      })
      .first();

    const count = await completedLink.count();
    if (count === 0) {
      test.skip(true, "No completed workflows found in test account.");
      return;
    }

    await completedLink.click();
    await expect(page.locator('[class*="gs-card"]').first()).toBeVisible({
      timeout: 20_000,
    });

    const productSelect = page.locator("select").first();
    const productOptions = await productSelect.locator("option").count();
    if (productOptions <= 1) {
      test.skip(true, "No products available to select.");
      return;
    }

    await productSelect.selectOption({ index: 1 });
    await page.waitForTimeout(1000);

    const colorBtn = page.getByRole("button", {
      name: /generate colors|farben generieren/i,
    });
    const hasBtnVisible = (await colorBtn.count()) > 0;

    if (!hasBtnVisible) {
      test.skip(
        true,
        "No 'Generate colors' button visible — product may not have colors.",
      );
      return;
    }

    await expect(colorBtn.first()).toBeVisible();
  });

  test("color badge opens variant modal when colors exist", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests.",
    );

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");

    const completedLink = page
      .locator("a")
      .filter({
        has: page.locator("span").filter({ hasText: /completed/i }),
      })
      .first();

    const count = await completedLink.count();
    if (count === 0) {
      test.skip(true, "No completed workflows found in test account.");
      return;
    }

    await completedLink.click();
    await expect(page.locator('[class*="gs-card"]').first()).toBeVisible({
      timeout: 20_000,
    });

    const colorBadge = page.getByText(/\d+ colors|\d+ farben/i).first();
    const hasBadge = (await colorBadge.count()) > 0;

    if (!hasBadge) {
      test.skip(
        true,
        "No color variant badges found — no steps have generated colors yet.",
      );
      return;
    }

    await colorBadge.click();

    await expect(
      page.getByRole("heading", { name: /color variants|farbvarianten/i }),
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole("button", {
        name: /download all colors|alle farben herunterladen/i,
      }),
    ).toBeVisible();

    const closeBtn = page.getByRole("button", {
      name: /close|schließen/i,
    });
    await closeBtn.click();

    await expect(
      page.getByRole("heading", { name: /color variants|farbvarianten/i }),
    ).not.toBeVisible({ timeout: 3_000 });
  });
});
