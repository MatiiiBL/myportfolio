import { lazy, type ComponentType, type LazyExoticComponent } from "react";

// Each flagship project's page body, one module per project (src/projects/<slug>/Page.tsx),
// loaded on demand so the home page does not ship every visualization. The keys must match the
// slugs in src/content/projects.ts (a unit test checks it).
export const projectPages: Record<string, LazyExoticComponent<ComponentType>> = {
  pulse: lazy(() => import("./pulse/Page")),
  apex: lazy(() => import("./apex/Page")),
  vecdex: lazy(() => import("./vecdex/Page")),
  minillm: lazy(() => import("./minillm/Page")),
  tessera: lazy(() => import("./tessera/Page")),
  precis: lazy(() => import("./precis/Page")),
};
