import { Link } from "react-router-dom";
import { profile } from "../content/profile";
import { projects } from "../content/projects";

export default function Home() {
  return (
    <div>
      <h1>{profile.name}</h1>
      <p>{profile.pitch}</p>
      <ul>
        {projects.map((p) => (
          <li key={p.slug}>
            <Link to={`/projects/${p.slug}`}>{p.name}</Link>: {p.tagline}
          </li>
        ))}
      </ul>
    </div>
  );
}
