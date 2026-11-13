import { Suspense } from "react";
import { Route, Routes, useParams } from "react-router-dom";
import { Shell } from "./components/Shell";
import { ProjectLayout } from "./components/ProjectLayout";
import { projectBySlug } from "./content/projects";
import { projectPages } from "./projects/registry";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

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
        <Route path="/" element={<Home />} />
        <Route path="/projects/:slug" element={<ProjectRoute />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Shell>
  );
}
