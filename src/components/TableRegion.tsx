import type { ReactNode } from "react";
import "./ProjectPage.css";

interface TableRegionProps {
  /** What the table holds, e.g. "Baseline results": the name screen readers give the region. */
  label: string;
  /** The table, usually a <table className="project-table"> with a <caption>. */
  children: ReactNode;
}

/**
 * The wrapper for a small results table that may be wider than a phone: it scrolls sideways
 * instead of widening the page, and it is a labelled, focusable region so keyboard users can
 * scroll it with the arrow keys (WCAG 2.1.1; axe's scrollable-region-focusable).
 */
export function TableRegion({ label, children }: TableRegionProps) {
  return (
    <div className="project-table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
