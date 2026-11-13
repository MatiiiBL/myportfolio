import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The site is served from https://matiiibl.github.io/myportfolio/ (GitHub Pages, gh-pages branch).
export default defineConfig({
  base: "/myportfolio/",
  plugins: [react()],
  // scripts/prerender.ts reads the manifest to find each route's lazy chunk and its stylesheets.
  build: { manifest: true },
  test: {
    environment: "jsdom",
    // Testing Library unmounts rendered components after each test only when afterEach is global.
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
