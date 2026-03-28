import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/web/e2e",
  fullyParallel: true,
  use: {
    baseURL: process.env.PAPERAI_WEB_BASE_URL,
    trace: "retain-on-failure",
  },
});
