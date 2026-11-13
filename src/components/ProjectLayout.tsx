import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Project } from "../content/types";
import { projects } from "../content/projects";
import { projectPath } from "../pages/meta";
import { Chip } from "./Chip";
import { Stat } from "./Stat";
import { TableOfContents } from "./TableOfContents";
import "./ProjectLayout.css";

interface ProjectLayoutProps {
  project: Project;
  /** The page's own sections (<Section> elements), written in src/projects/<slug>/Page.tsx. */
  children: ReactNode;
}

/**
 * The frame of every project page: a link back to the work, the header (kicker, name, tagline,
 * links, the three headline numbers, tags) from src/content/projects.ts, the page's sections
 * with a table of contents beside them on wide screens, and links to the neighboring projects.
 */
export function ProjectLayout({ project, children }: ProjectLayoutProps) {
  return (
    <article className="project-layout container">
      <header className="project-header">
        <Link to={{ pathname: "/", hash: "#work" }} className="project-back">
          ← All work
        </Link>
        <p className="project-kicker">
          {project.kicker}
          <span className="project-date">{project.date}</span>
        </p>
        <h1 className="project-name">{project.name}</h1>
        <p className="project-tagline">{project.tagline}</p>
        <p className="project-links">
          <a href={project.repo}>Source on GitHub ↗</a>
          {project.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label} ↗
            </a>
          ))}
        </p>
        <dl className="project-stats">
          {project.stats.map((stat) => (
            <Stat key={stat.label} {...stat} />
          ))}
        </dl>
        <ul className="project-tags" aria-label="Built with">
          {project.tags.map((tag) => (
            <li key={tag}>
              <Chip>{tag}</Chip>
            </li>
          ))}
        </ul>
      </header>
      <div className="project-main">
        <div className="project-body">{children}</div>
        <TableOfContents bodySelector=".project-body" />
      </div>
      <ProjectNeighbors slug={project.slug} />
    </article>
  );
}

/** Previous and next project, in home-page order, wrapping around at the ends. */
function ProjectNeighbors({ slug }: { slug: string }) {
  const i = projects.findIndex((p) => p.slug === slug);
  if (i < 0 || projects.length < 2) return null;
  const prev = projects[(i - 1 + projects.length) % projects.length];
  const next = projects[(i + 1) % projects.length];
  return (
    <nav className="project-neighbors" aria-label="More projects">
      {prev && (
        <Link to={projectPath(prev.slug)} className="project-neighbor" rel="prev">
          <span className="project-neighbor-dir">← Previous</span>
          <span className="project-neighbor-name">{prev.name}</span>
          <span className="project-neighbor-kicker">{prev.kicker}</span>
        </Link>
      )}
      {next && (
        <Link to={projectPath(next.slug)} className="project-neighbor is-next" rel="next">
          <span className="project-neighbor-dir">Next →</span>
          <span className="project-neighbor-name">{next.name}</span>
          <span className="project-neighbor-kicker">{next.kicker}</span>
        </Link>
      )}
    </nav>
  );
}
