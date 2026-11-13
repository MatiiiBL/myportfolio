import { useId, type ReactNode } from "react";
import "./Figure.css";

interface FigureProps {
  /** What the figure shows, in a few words. */
  title?: string;
  /** Conditions or units, in the mono style: "8×8 array · INT8 · one tile". */
  subtitle?: string;
  /** What the viewer is looking at and where the data comes from. */
  caption?: ReactNode;
  children: ReactNode;
}

/**
 * The panel every chart and visualization sits in: a bordered card with a title, an optional
 * mono subtitle and a caption underneath. Charts get it through ChartFrame; a custom
 * visualization can use it directly so it matches them.
 */
export function Figure({ title, subtitle, caption, children }: FigureProps) {
  const id = useId();
  const titleId = `${id}title`;
  return (
    <figure className="figure" aria-labelledby={title ? titleId : undefined}>
      {(title || subtitle) && (
        <div className="figure-head">
          {title && (
            <p id={titleId} className="figure-title">
              {title}
            </p>
          )}
          {subtitle && <p className="figure-subtitle">{subtitle}</p>}
        </div>
      )}
      {children}
      {caption && <figcaption className="figure-caption">{caption}</figcaption>}
    </figure>
  );
}
