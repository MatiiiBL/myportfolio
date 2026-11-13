import { profile } from "../content/profile";
import { projectBySlug, projects } from "../content/projects";

// Per-route title, description and canonical path. The prerender script writes them into each
// page's <head>, and the client keeps document.title in step on navigation, so both read the
// same values from here.

export interface RouteMeta {
  title: string;
  description: string;
  /** Canonical path with a trailing slash ("/projects/pulse/"), or null for the 404 page. */
  path: string | null;
  /** Open Graph type. */
  type: "website" | "article";
}

/** The home page's sections, in page order; the header links to them. */
export const homeSections = [
  { id: "work", label: "Work" },
  { id: "experience", label: "Experience" },
  { id: "toolbox", label: "Toolbox" },
  { id: "about", label: "About" },
  { id: "contact", label: "Contact" },
] as const;

/** Every page that exists, as canonical paths. */
export const routePaths: string[] = ["/", ...projects.map((p) => projectPath(p.slug))];

export function projectPath(slug: string): string {
  return `/projects/${slug}/`;
}

/** The public URL of a canonical path. */
export function absoluteUrl(path: string): string {
  return new URL(path.replace(/^\//, ""), profile.siteUrl).href;
}

const home: RouteMeta = {
  title: `${profile.name} · Computer Engineering at Columbia`,
  description:
    `${profile.name}, Computer Engineering at Columbia. I build fast, verified systems from ` +
    "scratch: a RISC-V SoC, a driverless racing stack, a tensor compiler, vector search and " +
    "LLM inference.",
  path: "/",
  type: "website",
};

export const notFoundMeta: RouteMeta = {
  title: `Page not found · ${profile.name}`,
  description: "There is no page at this address.",
  path: null,
  type: "website",
};

/** Metadata for a router pathname (without the site's base path). */
export function metaFor(pathname: string): RouteMeta {
  const clean = pathname.replace(/\/+$/, "") || "/";
  if (clean === "/") return home;
  const match = /^\/projects\/([^/]+)$/.exec(clean);
  const project = match?.[1] ? projectBySlug(match[1]) : undefined;
  if (!project) return notFoundMeta;
  return {
    title: `${project.name}: ${project.tagline.replace(/\.$/, "")} · ${profile.name}`,
    description: project.summary,
    path: projectPath(project.slug),
    type: "article",
  };
}
