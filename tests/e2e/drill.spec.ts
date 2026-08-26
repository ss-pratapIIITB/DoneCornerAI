import { test, expect } from "@playwright/test";

test("clicking a bar drills from period to function", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample pack" }).click();
  await expect(page.locator("[data-grain=period]")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("P&L, Cash, and Growth")).toBeVisible();
  await page.locator("[data-drill-key]").first().click();
  await expect(page.locator("[data-grain=function]")).toBeVisible();
  await page.getByRole("button", { name: "Up" }).click();
  await expect(page.locator("[data-grain=period]")).toBeVisible();
});
