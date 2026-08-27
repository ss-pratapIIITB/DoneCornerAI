import { test, expect } from "@playwright/test";

test("agent rail waiting fixture shows publish approval", async ({ page }) => {
  await page.goto("/?rail=waiting_approval");
  await expect(page.locator("[data-agent-status=waiting_approval]")).toBeVisible();
  await expect(page.getByText("Waiting for approval")).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve publish" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Deny publish" })).toBeVisible();
});

test("query bar talks to TrueForge when it is running", async ({ page, request }) => {
  const health = await request.get("/api/session");
  test.skip(!health.ok(), "TrueForge is not running");
  const session = await request.post("/api/session", { data: {} });
  test.skip(!session.ok(), "TrueForge has no usable model");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Ask" })).toBeEnabled();
  await page.getByLabel("Ask the close pack").fill("Why is S&M over budget?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.locator("[data-agent-status=running]")).toBeVisible();
});
