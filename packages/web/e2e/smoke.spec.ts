import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/en/dashboard");
  await page.waitForURL(/\/(en|de)\/login/);
  await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
});

test("login page renders email and password fields", async ({ page }) => {
  await page.goto("/en/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in/i }),
  ).toBeVisible();
});

test("login page has Google sign-in button", async ({ page }) => {
  await page.goto("/en/login");
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});

test("email/password login reaches dashboard (session cookie)", async ({
  page,
}) => {
  test.skip(
    !hasE2eAuthCredentials(),
    "Set E2E_EMAIL and E2E_PASSWORD to run authenticated login E2E.",
  );
  test.setTimeout(90_000);
  await signInWithEmail(page);
  await expect(page).toHaveURL(/\/en\/dashboard(\/|$)/);
  await expect(
    page.getByText("Your Amazon product image command center."),
  ).toBeVisible({ timeout: 20_000 });
});
