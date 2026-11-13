import type { ReactNode } from "react";
import type { Project } from "../content/types";
import { Chip } from "./Chip";
import { Stat } from "./Stat";
import "./ProjectLayout.css";

interface ProjectLayoutProps {
  project: Project;
  /** The page's own sections (<Section> elements), written in src/projects/<slug>/Page.tsx. */
  children: ReactNode;
}

/**
 * The frame of every project page: the header (kicker, name, tagline, links, the three
 * headline numbers, tags) from src/content/projects.ts, then the page's sections.
 */
export function ProjectLayout({ project, children }: ProjectLayoutProps) {
  return (
    <article className="project-layout">
      <header className="project-header">
        <p className="project-kicker">{project.kicker}</p>
        <h1 className="project-name">{project.name}</h1>
        <p className="project-tagline">{project.tagline}</p>
        <p className="project-links">
          <a href={project.repo}>Source on GitHub</a>
          {project.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.label}
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
      <div className="project-body">{children}</div>
    </article>
  );
}
