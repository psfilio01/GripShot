import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

/**
 * Authenticated E2E: human model CRUD UI + lifestyle “Human model” dropdown.
 *
 * Skips automatically unless E2E_EMAIL and E2E_PASSWORD are set (Firebase user with email/password).
 * Ensure packages/web/.env.local has valid Firebase client config and the dev server can reach Firestore.
 */
test.describe("Human models & generate (authenticated)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("models list → create model → detail; Generate shows lifestyle model picker with new model", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests (Firebase email/password user).",
    );

    await signInWithEmail(page);

    await page.goto("/en/dashboard/human-models");
    await expect(
      page.getByRole("heading", { name: "Human models" }),
    ).toBeVisible();

    const name = `E2E Model ${Date.now()}`;
    await page.getByTestId("human-model-display-name").fill(name);
    await page.getByTestId("human-model-create-submit").click();

    await expect(page).toHaveURL(
      /\/(en|de)\/dashboard\/human-models\/[a-zA-Z0-9_-]+$/,
    );
    await expect(
      page.getByRole("heading", { name: "Reference photos" }),
    ).toBeVisible();
    await expect(page.getByLabel("Display name")).toHaveValue(name);

    await page.goto("/en/dashboard/generate");
    await page.getByRole("button", { name: "Image generation" }).click();

    await page
      .getByTestId("image-gen-workflow-type")
      .selectOption("AMAZON_LIFESTYLE_SHOT");

    const modelSelect = page.getByTestId("image-gen-human-model");
    await expect(modelSelect).toBeVisible();
    await expect(modelSelect.locator("option").first()).toContainText(/Random/i);
    await expect(modelSelect.locator(`option:has-text("${name}")`)).toHaveCount(1);
  });
});
