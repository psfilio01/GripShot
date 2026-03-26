import { test, expect } from "@playwright/test";

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
