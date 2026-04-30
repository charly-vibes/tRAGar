import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/browser",
  // Fail fast — smoke tests should be quick.
  timeout: 30_000,
  retries: 0,
  workers: 1,

  webServer: {
    // Serve the entire project root so that both the example and the dist/
    // bundle are reachable under the same origin.
    command: "python3 -m http.server 3456 --directory .",
    url: "http://localhost:3456",
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },

  use: {
    baseURL: "http://localhost:3456",
    headless: true,
    // Keep videos and traces only on failure to avoid disk churn.
    video: "retain-on-failure",
    trace: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
});
