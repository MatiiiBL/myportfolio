import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/inter";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
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
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);
