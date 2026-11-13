import { useEffect, useRef, type ReactNode } from "react";
import { Link, useLocation, useNavigationType } from "react-router-dom";
import { profile } from "../content/profile";
import { absoluteUrl, homeSections, metaFor } from "../pages/meta";
import { ThemeToggle } from "./ThemeToggle";
import "./Shell.css";

/** The site's source repository, linked from the footer. */
const SOURCE_URL = `${profile.links.github}/myportfolio`;

/** Header, footer and skip link around every page, plus what a route change must update. */
export function Shell({ children }: { children: ReactNode }) {
  useRouteMeta();
  useScrollOnNavigate();
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container site-header-inner">
          <Link to="/" className="site-name">
            {profile.name}
          </Link>
          <nav className="site-nav" aria-label="Sections">
            <ul>
              {homeSections.map((s) => (
                <li key={s.id} className={`site-nav-${s.id}`}>
                  <Link to={{ pathname: "/", hash: `#${s.id}` }}>{s.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <div className="container site-footer-inner">
          <div>
            <p className="site-footer-name">{profile.name}</p>
            <p>{profile.headline}</p>
          </div>
          <ul className="site-footer-links">
            <li>
              <a href={`mailto:${profile.email}`}>{profile.email}</a>
            </li>
            <li>
              <a href={profile.links.github}>GitHub</a>
            </li>
            <li>
              <a href={profile.links.linkedin}>LinkedIn</a>
            </li>
          </ul>
          <p className="site-footer-note">
            Built by hand, <a href={SOURCE_URL}>source on GitHub</a>.
          </p>
        </div>
      </footer>
    </>
  );
}

/** Keeps the title, description and canonical link in step with the route. */
function useRouteMeta() {
  const { pathname } = useLocation();
  useEffect(() => {
    const meta = metaFor(pathname);
    document.title = meta.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", meta.description);
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (canonical && meta.path) canonical.href = absoluteUrl(meta.path);
  }, [pathname]);
}

/**
 * After a link is followed, scrolls to its #fragment or to the top, and moves focus to the new
 * content so keyboard and screen-reader users start there. Back and forward are left to the
 * browser, which restores the previous position.
 */
function useScrollOnNavigate() {
  const { pathname, hash, key } = useLocation();
  const navigation = useNavigationType();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (navigation === "POP") return;
    if (!hash) {
      // A new page starts at its top; smooth scrolling is for moving within a page.
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.getElementById("main")?.focus({ preventScroll: true });
      return;
    }
    return scrollToFragment(decodeURIComponent(hash.slice(1)));
  }, [pathname, hash, key, navigation]);
}

/** Scrolls to an element by id, waiting briefly for it if the page is still loading. */
function scrollToFragment(id: string): () => void {
  const reveal = (el: HTMLElement) => {
    el.scrollIntoView({ block: "start" });
    const focusable = el.matches("a, button, input, [tabindex]");
    if (!focusable) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  };
  const el = document.getElementById(id);
  if (el) {
    reveal(el);
    return () => {};
  }
  const observer = new MutationObserver(() => {
    const found = document.getElementById(id);
    if (found) {
      observer.disconnect();
      reveal(found);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  const timeout = window.setTimeout(() => observer.disconnect(), 3000);
  return () => {
    observer.disconnect();
    window.clearTimeout(timeout);
  };
}
