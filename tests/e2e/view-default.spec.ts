import { test, expect } from "@playwright/test";

test("portal opens in view mode without drag handles", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-mode=view]")).toBeVisible();
  await expect(page.locator("[data-draggable]")).toHaveCount(0);
});

test("signal room prioritizes exceptions and agent work", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-signal-room]")).toBeVisible();
  await expect(page.getByText("Primary exception")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Exception queue" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "TrueForge agent" })).toBeVisible();
});
