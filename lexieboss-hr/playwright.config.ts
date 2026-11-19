import { defineConfig, devices } from "@playwright/test";
import { execFileSync } from "node:child_process";

let chromiumPath: string | undefined;
try {
  chromiumPath = execFileSync("which", ["chromium"], { encoding: "utf8" }).trim();
} catch {
  // Playwright's managed browser is used when Chromium is not installed.
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath: chromiumPath,
      args: ["--no-sandbox"],
    },
  },
  webServer: {
    command: "PORT=4173 BASE_PATH=/ VITE_E2E=true pnpm --filter @workspace/lexieboss run dev",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});