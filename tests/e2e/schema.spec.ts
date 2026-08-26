import { test, expect } from "@playwright/test";

test("schema lists facts_pnl and adds a KPI in edit", async ({ page }) => {
  await page.goto("/schema");
  await expect(page.getByRole("heading", { name: "facts_pnl" })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("button", { name: "Add revenue as KPI" })).toBeVisible();
  await page.getByRole("button", { name: "Add revenue as KPI" }).click();
  await expect(page.getByText("Added revenue as kpi")).toBeVisible();
  await page.goto("/");
  await expect(page.locator(".widget-card").filter({ hasText: "revenue" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Note for revenue").first().fill("Subscription only.");
  await page.getByRole("button", { name: "Save note" }).click();
  await page.getByRole("button", { name: "View" }).click();
  await expect(page.getByText("Subscription only.")).toBeVisible();
  await expect(page.locator("[data-draggable]")).toHaveCount(0);
});
