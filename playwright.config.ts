import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build (npm run build), served by scripts/serve.ts
// the way GitHub Pages serves it: prerendered pages, and 404.html with status 404. E2E_PORT
// picks another port when 4173 is taken.
const port = Number(process.env.E2E_PORT ?? 4173);
const baseURL = `http://localhost:${port}/myportfolio/`;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `node scripts/serve.ts --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
  },
});
