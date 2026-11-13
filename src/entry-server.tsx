import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import App from "./App";

// Server entry for scripts/prerender.ts: renders one route to HTML at build time. prerender()
// waits for every Suspense boundary, so the lazily loaded project pages are complete in the
// static HTML; the client then hydrates that markup.

export { absoluteUrl, metaFor, notFoundMeta, routePaths } from "./pages/meta";
export { experience, profile } from "./content/profile";
export { projects } from "./content/projects";

/** The HTML of the app at a route path such as "/" or "/projects/pulse/". */
export async function render(path: string): Promise<string> {
  const base = import.meta.env.BASE_URL;
  const location = base + path.replace(/^\//, "");
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter basename={base} location={location}>
        <App />
      </StaticRouter>
    </StrictMode>,
  );
  return new Response(prelude).text();
}
