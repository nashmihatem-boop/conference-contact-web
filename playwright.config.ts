import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:4321";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  // Assumes `npm run dev` is already running (this suite hits the same
  // real backend the dev environment does — Stripe test mode, real
  // Postgres/Redis). Set webServer only for CI, where nothing is running
  // yet and a throwaway build/preview is fine.
  webServer: process.env.CI
    ? {
        command: "npm run build && npm run preview",
        url: baseURL,
        reuseExistingServer: false,
      }
    : undefined,
});
