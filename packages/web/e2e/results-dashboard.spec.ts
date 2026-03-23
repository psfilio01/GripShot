import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

/**
 * Authenticated E2E: Results dashboard shell (heading + intro copy).
 *
 * Skips unless E2E_EMAIL and E2E_PASSWORD are set (same as human-models.spec).
 */
test.describe("Results dashboard (authenticated)", () => {
  test.describe.configure({ timeout: 120_000 });

  test("Results page loads with title and gallery description", async ({
    page,
  }) => {
    test.skip(
      !hasE2eAuthCredentials(),
      "Set E2E_EMAIL and E2E_PASSWORD to run authenticated Playwright tests (Firebase email/password user).",
    );

    await signInWithEmail(page);
    await page.goto("/dashboard/results");

    await expect(page.getByRole("heading", { name: "Results" })).toBeVisible();
    await expect(
      page.getByText(
        /Browse, filter, and manage your generated images/i,
      ),
    ).toBeVisible();
  });
});
