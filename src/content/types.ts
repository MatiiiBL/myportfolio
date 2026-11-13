// The site's content model. Everything a page says about a project, a job or a skill lives in
// src/content/, typed here, so the home page, the project pages and the SEO metadata can never
// disagree. Numbers come from each project's README and committed results; see docs/site.md.

export interface Stat {
  /** The headline value, as displayed: "115×", "1.4 cm", "33/33". */
  value: string;
  /** What it measures, in a few words: "faster MNIST on the NPU than the CPU". */
  label: string;
}

export interface Link {
  label: string;
  href: string;
}

/** A project with its own deep-dive page at /projects/<slug>. */
export interface Project {
  slug: string;
  name: string;
  /** Short category line shown above the name: "Hardware · SystemVerilog". */
  kicker: string;
  /** One sentence: what it is. */
  tagline: string;
  /** Two or three sentences for the home page card and the meta description. */
  summary: string;
  /** Exactly three headline numbers, the strongest first. */
  stats: [Stat, Stat, Stat];
  /** Languages and tools, the most defining first (at most six). */
  tags: string[];
  repo: string;
  /** Extra links: docs, results, write-ups. */
  links: Link[];
  /** When it was built, e.g. "Nov 2026". */
  date: string;
}

/** Smaller work shown as cards on the home page, without a deep-dive page. */
export interface MinorProject {
  name: string;
  kicker: string;
  /** An award or placement, if any: "AI category winner · makeCU". */
  award?: string;
  summary: string;
  tags: string[];
  repo: string;
  /** What I did, when it was a team project. */
  role?: string;
}

export interface Experience {
  org: string;
  role: string;
  place: string;
  /** "Dec 2025 – Oct 2026". */
  period: string;
  summary: string;
  link?: string;
}

export interface ToolboxRow {
  area: string;
  items: string[];
}

export interface Profile {
  name: string;
  /** "Computer Engineering · Columbia University" */
  headline: string;
  /** The one-line pitch under the name. */
  pitch: string;
  /** What I do now, in one line: the hero and the About section show it. */
  status: string;
  /** A short first-person introduction (two or three sentences). */
  intro: string;
  /** A personal note for the about section. */
  about: string[];
  education: { school: string; degree: string; minor: string; graduation: string };
  location: string;
  email: string;
  links: { github: string; linkedin: string };
  languages: { name: string; level: string }[];
  activities: string[];
  siteUrl: string;
}
