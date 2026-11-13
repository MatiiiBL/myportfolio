import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// The site is served from https://matiiibl.github.io/myportfolio/ (GitHub Pages, gh-pages branch).
export default defineConfig({
  base: "/myportfolio/",
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
