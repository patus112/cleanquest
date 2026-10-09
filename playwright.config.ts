import { defineConfig, devices } from "@playwright/test";
const base = process.env.VITE_BASE_PATH || "/cleanquest/";
export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: `http://127.0.0.1:4174${base}`,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "mobile-chromium",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
    { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    command: "node scripts/serve-static.mjs",
    url: `http://127.0.0.1:4174${base}`,
    reuseExistingServer: !process.env.CI,
  },
});
