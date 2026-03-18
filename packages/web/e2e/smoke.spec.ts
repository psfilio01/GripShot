import { test, expect } from "@playwright/test";

test("unauthenticated user is redirected to login", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  await expect(page.locator("h1")).toContainText("Grip Shot");
});

test("login page renders email and password fields", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: /sign in/i }),
  ).toBeVisible();
});

test("login page has Google sign-in button", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("button", { name: /continue with google/i }),
  ).toBeVisible();
});
