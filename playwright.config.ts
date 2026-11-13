import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the production build (npm run build), served by vite preview.
export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://localhost:4173/myportfolio/" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173/myportfolio/",
    reuseExistingServer: !process.env.CI,
  },
});
