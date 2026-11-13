import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// The site's text is Latin, so only the Latin subsets of both faces are declared (fonts.css).
import "./styles/fonts.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "./styles/tokens.css";
import "./styles/global.css";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root element");

const app = (
  <StrictMode>
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);

// Built pages arrive prerendered (scripts/prerender.ts), so React attaches to that markup; the
// dev server sends an empty root and React renders from scratch.
if (root.firstElementChild) {
  const hydrate = () => hydrateRoot(root, app);
  // Let the browser paint the prerendered page first: hydrating starts the page's lazy chunk
  // downloads and their work, and on a slow phone they would otherwise compete with the first
  // paint for the network and the main thread. A hidden tab never paints, so it hydrates at once.
  if (document.visibilityState === "visible") requestAnimationFrame(() => setTimeout(hydrate, 0));
  else hydrate();
} else {
  createRoot(root).render(app);
}
