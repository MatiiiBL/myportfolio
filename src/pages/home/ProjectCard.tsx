import { Link } from "react-router-dom";
import type { MinorProject, Project } from "../../content/types";
import { Chip } from "../../components/Chip";
import { Stat } from "../../components/Stat";
import { projectPath } from "../meta";

/** A flagship project: the whole card links to its deep dive; the source link sits on top. */
export function ProjectCard({ project }: { project: Project }) {
  const titleId = `work-${project.slug}`;
  return (
    <article className="work-card" aria-labelledby={titleId}>
      <p className="work-kicker">{project.kicker}</p>
      <h3 id={titleId} className="work-name">
        <Link to={projectPath(project.slug)} className="work-link">
          {project.name}
        </Link>
      </h3>
      <p className="work-tagline">{project.tagline}</p>
      <p className="work-summary">{project.summary}</p>
      <dl className="work-stats">
        {project.stats.map((stat) => (
          <Stat key={stat.label} {...stat} />
        ))}
      </dl>
      <ul className="work-tags" aria-label="Built with">
        {project.tags.map((tag) => (
          <li key={tag}>
            <Chip>{tag}</Chip>
          </li>
        ))}
      </ul>
      <p className="work-actions">
        <span className="work-more" aria-hidden="true">
          Deep dive →
        </span>
        <a className="work-source" href={project.repo}>
          Source<span className="visually-hidden"> of {project.name} on GitHub</span> ↗
        </a>
      </p>
    </article>
  );
}

/** A smaller project: no deep dive, a link to its repository. */
export function MinorCard({ project }: { project: MinorProject }) {
  return (
    <article className="minor-card">
      <p className="work-kicker">{project.kicker}</p>
      <h3 className="minor-name">
        <a href={project.repo} className="work-link">
          {project.name}
          <span className="visually-hidden"> on GitHub</span>
        </a>
      </h3>
      {project.award && <p className="minor-award">{project.award}</p>}
      <p className="work-summary">{project.summary}</p>
      {project.role && <p className="minor-role">{project.role}</p>}
      <ul className="work-tags" aria-label="Built with">
        {project.tags.map((tag) => (
          <li key={tag}>
            <Chip>{tag}</Chip>
          </li>
        ))}
      </ul>
    </article>
  );
}
