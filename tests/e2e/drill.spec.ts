import { test, expect } from "@playwright/test";

test("clicking a bar drills from period to group", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load sample pack" }).click();
  await page.getByRole("button", { name: "Start load" }).click();
  await expect(page.locator("[data-grain=period]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "P&L" })).toBeVisible();
  await page.locator("[data-drill-key]").first().click();
  await expect(page.locator("[data-grain=group]")).toBeVisible();
  await page.getByRole("button", { name: "Up" }).click();
  await expect(page.locator("[data-grain=period]")).toBeVisible();
});
