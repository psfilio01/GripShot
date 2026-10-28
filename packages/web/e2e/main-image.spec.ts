import { test, expect } from "@playwright/test";
import { signInWithEmail, hasE2eAuthCredentials } from "./helpers/auth";

// UI integration uses real session authentication but mocks all image jobs and
// mutations: no Gemini requests, production product edits or billed generations.
test.describe("Main image review workflow", () => {
  test.describe.configure({ timeout: 120_000 });

  test("create, compare, explicitly approve and delete only the Main copy", async ({ page }) => {
    test.skip(!hasE2eAuthCredentials(), "E2E email/password required");
    await signInWithEmail(page);
    let created = false;
    let reviewed = false;
    let deleted = false;
    let creationBody: unknown;
    await page.route("**/api/products", (route) => route.fulfill({ json: { products: [{ id: "fixture-product", name: "Mini Ball", colors: [] }] } }));
    await page.route("**/api/jobs", (route) => route.fulfill({ json: {
      jobs: [{ jobId: "source-job", productId: "fixture-product", workflowType: "EXTERNAL_HERO_UPLOAD", status: "completed", createdAt: new Date().toISOString(), images: [{ imageId: "source-image", status: "hero_lock", filePath: "generated/source.png" }] },
        ...(created && !deleted ? [{ jobId: "main-job", productId: "fixture-product", workflowType: "MAIN_WHITE_BACKGROUND", status: "completed", createdAt: new Date().toISOString(), images: [{ imageId: "main-copy", status: "neutral", filePath: "generated/main.png", mainImage: { sourceVariantId: "source-image", sourceSha256: "fixture", preserveShadow: true, reviewed } }] }] : [])],
      pendingImageGenerations: [],
    } }));
    await page.route("**/api/main-image", async (route) => {
      creationBody = route.request().postDataJSON();
      created = true;
      await route.fulfill({ status: 202, json: { requestId: "main-request", sourceImageId: "source-image" } });
    });
    await page.route("**/api/main-image/main-copy", async (route) => {
      if (route.request().method() === "PATCH") {
        expect(route.request().postDataJSON()).toEqual({ reviewed: true });
        reviewed = true;
      } else if (route.request().method() === "DELETE") {
        deleted = true;
      }
      await route.fulfill({ json: { ok: true, deletedImageIds: deleted ? ["main-copy"] : [] } });
    });

    await page.goto("/en/dashboard/results");
    await page.getByRole("button", { name: "Main image · white background", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Create a white-background Main image" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: /Preserve the natural contact shadow/ })).toBeChecked();
    await page.getByRole("button", { name: "Create Main image", exact: true }).click();
    await expect(page.getByText("Main · review preview", { exact: true })).toBeVisible();
    expect(creationBody).toEqual({ imageId: "source-image", preserveShadow: true });

    await page.getByRole("button", { name: "Compare original / Main" }).click();
    const approve = page.getByRole("button", { name: "Mark as reviewed", exact: true });
    await expect(approve).toBeDisabled();
    await expect(page.getByRole("img", { name: "Original", exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: "Main image · PNG", exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /I have inspected/ }).check();
    await approve.click();
    await expect(page.getByText("Main · reviewed by you", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Main", exact: true }).click();
    await expect(page.getByRole("button", { name: "Main image · white background", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Delete Main image", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "" }).filter({ hasText: "Only this Main image copy" });
    await dialog.getByRole("button", { name: "Delete Main image", exact: true }).click();
    await expect(page.getByText("Main · reviewed by you", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(page.getByRole("button", { name: "Main image · white background", exact: true })).toBeVisible();
    expect(deleted).toBe(true);
  });
});
