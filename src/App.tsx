import { lazy, Suspense } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ProjectLayout } from "./components/ProjectLayout";
import { projectBySlug } from "./content/projects";
import { projectPages } from "./projects/registry";
import NotFound from "./pages/NotFound";

// The home page is its own chunk, so its code and styles (the hero search among them) stay out
// of what every project page loads. Every route is prerendered, so this costs no blank frame.
const Home = lazy(() => import("./pages/Home"));

function ProjectRoute() {
  const { slug = "" } = useParams();
  const project = projectBySlug(slug);
  const Page = projectPages[slug];
  if (!project || !Page) return <NotFound />;
  return (
    <ProjectLayout project={project}>
      <Suspense fallback={null}>
        <Page />
      </Suspense>
    </ProjectLayout>
  );
}

export default function App() {
  return (
    <Shell>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={null}>
              <Home />
            </Suspense>
          }
        />
        <Route path="/projects/:slug" element={<ProjectRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
