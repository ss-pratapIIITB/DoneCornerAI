import { defineConfig, devices } from "@playwright/test";

const port = process.env.E2E_PORT ?? "3000";
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL, trace: "on-first-retry" },
  webServer: {
    command: `npx next dev --turbopack --port ${port}`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    env: { ...process.env, DONECORNER_DB: ".data/e2e.sqlite" },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
