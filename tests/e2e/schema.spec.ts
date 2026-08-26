import { test, expect } from "@playwright/test";

test("schema lists facts_pnl and adds a KPI in edit", async ({ page }) => {
  await page.goto("/schema");
  await expect(page.getByRole("heading", { name: "facts_pnl" })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("button", { name: "Add revenue as KPI" })).toBeVisible();
  await page.getByRole("button", { name: "Add revenue as KPI" }).click();
  await expect(page.getByText("Added revenue as kpi")).toBeVisible();
  await page.goto("/");
  const card = page.locator(".widget-card").filter({ hasText: "revenue" }).first();
  await expect(card).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await card.getByLabel("Note for revenue").fill("Subscription only.");
  await card.getByRole("button", { name: "Save note" }).click();
  await page.getByRole("button", { name: "View" }).click();
  await expect(card.getByText("Subscription only.")).toBeVisible();
  await expect(page.locator("[data-draggable]")).toHaveCount(0);
});
