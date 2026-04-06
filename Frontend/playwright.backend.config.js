import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: ["backend-api.spec.js"],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.BACKEND_BASE_URL || "http://127.0.0.1:8000",
    extraHTTPHeaders: {
      Accept: "application/json"
    }
  }
});
