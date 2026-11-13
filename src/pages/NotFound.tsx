import { Link } from "react-router-dom";
import { projects } from "../content/projects";
import { projectPath } from "./meta";
import "./NotFound.css";

/** The 404 page: what happened, and the pages that do exist. */
export default function NotFound() {
  return (
    <div className="container not-found">
      <p className="not-found-code">404</p>
      <h1>Page not found</h1>
      <p className="not-found-lead">
        There is no page at this address. It may have moved when the site was rebuilt.
      </p>
      <p>
        <Link to="/" className="not-found-home">
          Go to the home page
        </Link>
      </p>
      <h2>Projects</h2>
      <ul className="not-found-list">
        {projects.map((p) => (
          <li key={p.slug}>
            <Link to={projectPath(p.slug)}>{p.name}</Link>
            <span>{p.tagline}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
