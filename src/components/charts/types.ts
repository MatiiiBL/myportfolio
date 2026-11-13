import type { ReactNode } from "react";

/**
 * A series' color: one of the three categorical slots (--series-1..3, in that fixed order) or
 * "muted" for context the reader should look past (other systems, a baseline).
 */
export type SeriesColor = 1 | 2 | 3 | "muted";

/** The CSS color of a series slot, always through the design tokens. */
export function seriesColor(color: SeriesColor): string {
  return color === "muted" ? "var(--text-3)" : `var(--series-${color})`;
}

/** Slots are assigned in order and never cycled: a fourth unassigned series is muted. */
export function defaultColor(index: number): SeriesColor {
  return index === 0 ? 1 : index === 1 ? 2 : index === 2 ? 3 : "muted";
}

/** Text shared by every chart. */
export interface ChartText {
  /** What is plotted, e.g. "SIFT1M: recall@10 against queries per second". */
  title: string;
  /** Conditions in the mono style, e.g. "log scale · 1 thread · Apple M4". */
  subtitle?: string;
  /**
   * Shown under the chart: what the viewer is looking at and where the numbers come from. With
   * the chart's data table, this is its text alternative.
   */
  caption?: ReactNode;
}

export interface LegendItem {
  label: string;
  color: SeriesColor;
  /** The key mirrors the mark: a short line for line series, a square for bars. */
  mark: "line" | "bar";
}

/** One row of a tooltip: a series' value at the active position. */
export interface TooltipRow {
  label: string;
  value: string;
  color: SeriesColor;
  mark: "line" | "bar";
}

/** A position the tooltip can stop at (a data x, or a category), in SVG pixels. */
export interface TooltipStop {
  x: number;
  y: number;
  title: string;
  rows: TooltipRow[];
}

/** The data behind a chart, rendered as a table for screen readers. */
export interface ChartTable {
  /** Column headers; the first names the row headers (the x value or the category). */
  columns: string[];
  rows: string[][];
}
