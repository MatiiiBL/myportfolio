import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { INTRO_SCREEN, INTRO_SCREEN_PLACEHOLDER } from "./src/pages/home/intro/screen.ts";

// The site is served from https://matiiibl.github.io/myportfolio/ (GitHub Pages, gh-pages branch).
export default defineConfig({
  base: "/myportfolio/",
  plugins: [react(), introScreen()],
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

/**
 * Writes the scroll intro's screen condition (src/pages/home/intro/screen.ts) into index.html's
 * head script, so the script and the intro's code share one definition.
 */
function introScreen(): Plugin {
  return {
    name: "intro-screen",
    transformIndexHtml(html) {
      if (!html.includes(INTRO_SCREEN_PLACEHOLDER)) {
        throw new Error(`index.html: the intro's head script lacks ${INTRO_SCREEN_PLACEHOLDER}`);
      }
      return html.replaceAll(INTRO_SCREEN_PLACEHOLDER, INTRO_SCREEN);
    },
  };
}
