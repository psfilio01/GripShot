import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

test.describe("Workflows", () => {
  test("overview page renders after login", async ({ page }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E.",
    );
    test.setTimeout(90_000);

    await signInWithEmail(page);
    await page.goto("/en/dashboard/workflows");
    await expect(
      page.getByRole("heading", { name: /workflows/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /new workflow/i }),
    ).toBeVisible();
  });

  test("happy path: create workflow → generate plan → generate step", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated E2E.",
    );
    test.setTimeout(180_000);

    await signInWithEmail(page);

    // Navigate to workflows
    await page.goto("/en/dashboard/workflows");
    await expect(
      page.getByRole("button", { name: /new workflow/i }),
    ).toBeVisible({ timeout: 20_000 });

    // Open create modal
    await page.getByRole("button", { name: /new workflow/i }).click();
    await expect(
      page.getByRole("heading", { name: /create workflow/i }),
    ).toBeVisible();

    // Product is required — pick first catalog item when available
    const createDialog = page.locator("dialog").filter({
      has: page.getByRole("heading", { name: /create workflow/i }),
    });
    const productSelect = createDialog.locator("select").first();
    await expect(productSelect).toBeVisible({ timeout: 15_000 });
    const productOptionCount = await productSelect.locator("option").count();
    test.skip(
      productOptionCount <= 1,
      "Workspace needs at least one product to create a workflow (API requires productId).",
    );
    await productSelect.selectOption({ index: 1 });

    // Fill form
    await page.getByPlaceholder(/full amazon listing/i).fill("E2E Test Workflow");
    await page
      .getByPlaceholder(/describe what content/i)
      .fill("Hero product shot and lifestyle image for an E2E test");

    // Submit
    const createResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/api/workflows") &&
        res.request().method() === "POST" &&
        res.status() === 201,
      { timeout: 30_000 },
    );
    await page.getByRole("button", { name: /create workflow/i }).last().click();
    await createResponse;

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/workflows\/[a-zA-Z0-9]+/, {
      timeout: 15_000,
    });

    // Should see the workflow name
    await expect(page.getByText("E2E Test Workflow")).toBeVisible({
      timeout: 10_000,
    });

    // Generate plan
    const planResponse = page.waitForResponse(
      (res) =>
        res.url().includes("/plan") &&
        res.request().method() === "POST" &&
        res.status() === 200,
      { timeout: 120_000 },
    );
    await page.getByRole("button", { name: /generate plan/i }).click();
    await planResponse;

    // Should see step cards appear
    await expect(
      page.locator('[class*="gs-card"]').first(),
    ).toBeVisible({ timeout: 15_000 });

    // Verify at least one "Generate" button exists on a step card
    await expect(
      page.getByRole("button", { name: /^generate$/i }).first(),
    ).toBeVisible();

    // If products exist, select the first and generate one step
    const generationProductSelect = page.locator("select");
    const productOptions = await generationProductSelect.locator("option").count();

    if (productOptions > 1) {
      await generationProductSelect.selectOption({ index: 1 });

      const execResponse = page.waitForResponse(
        (res) =>
          res.url().includes("/execute") &&
          res.request().method() === "POST",
        { timeout: 120_000 },
      );
      await page.getByRole("button", { name: /^generate$/i }).first().click();
      await execResponse;

      // Should see at least one completed badge
      await expect(
        page.getByText(/completed/i).first(),
      ).toBeVisible({ timeout: 10_000 });
    }
  });
});
