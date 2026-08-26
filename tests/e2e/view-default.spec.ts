import { test, expect } from "@playwright/test";

test("portal opens in view mode without drag handles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-mode=view]")).toBeVisible();
  await expect(page.locator("[data-draggable]")).toHaveCount(0);
});
