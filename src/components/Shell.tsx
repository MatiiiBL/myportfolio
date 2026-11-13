import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { profile } from "../content/profile";

/** Header and footer around every page. */
export function Shell({ children }: { children: ReactNode }) {
  return (
    <>
      <header>
        <Link to="/">{profile.name}</Link>
      </header>
      <main id="main">{children}</main>
      <footer>
        <a href={`mailto:${profile.email}`}>{profile.email}</a>
      </footer>
    </>
  );
}
