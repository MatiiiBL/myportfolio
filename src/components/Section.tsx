import type { ReactNode } from "react";
import "./Section.css";

interface SectionProps {
  /** Anchor id, also used by the page's table of contents. */
  id: string;
  title: string;
  /** Optional short line above the title, set in the accent mono style. */
  kicker?: string;
  children: ReactNode;
}

/** A titled block of a page. Project pages are a sequence of these. */
export function Section({ id, title, kicker, children }: SectionProps) {
  return (
    <section id={id} className="section" aria-labelledby={`${id}-title`}>
      {kicker && <p className="section-kicker">{kicker}</p>}
      <h2 id={`${id}-title`} className="section-title">
        {title}
      </h2>
      <div className="section-body">{children}</div>
    </section>
  );
}
