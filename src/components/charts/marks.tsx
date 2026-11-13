import { line } from "d3-shape";
import { barPath, f } from "./geometry";
import { CHART_FONT_SIZE, textWidth } from "./scales";
import { seriesColor, type SeriesColor } from "./types";
import type { PlotBox } from "./Axis";

/** A 2 px series line through points in pixels, with a gap wherever a point is null. */
export function LineMark({
  points,
  color,
}: {
  points: ([number, number] | null)[];
  color: SeriesColor;
}) {
  const path = line<[number, number] | null>()
    .defined((p) => p !== null)
    .x((p) => p?.[0] ?? 0)
    .y((p) => p?.[1] ?? 0)(points);
  if (!path) return null;
  return <path className="chart-line" d={path} style={{ stroke: seriesColor(color) }} />;
}

/** A data point: a dot of at least 8 px with a 2 px ring in the panel color. */
export function Dot({
  x,
  y,
  color,
  r = 4,
}: {
  x: number;
  y: number;
  color: SeriesColor;
  r?: number;
}) {
  return (
    <circle className="chart-dot" cx={f(x)} cy={f(y)} r={r} style={{ fill: seriesColor(color) }} />
  );
}

/** A bar from a baseline, square there and rounded at the data end. */
export function Bar({
  orientation,
  from,
  to,
  start,
  thickness,
  color,
  dimmed = false,
}: {
  orientation: "horizontal" | "vertical";
  /** Baseline coordinate along the value axis. */
  from: number;
  /** Data-end coordinate along the value axis. */
  to: number;
  /** Position across the value axis (top edge, or left edge). */
  start: number;
  thickness: number;
  color: SeriesColor;
  /** Faded while another category is active. */
  dimmed?: boolean;
}) {
  const d = barPath(orientation, from, to, start, thickness);
  if (!d) return null;
  return (
    <path
      className={dimmed ? "chart-bar is-dimmed" : "chart-bar"}
      d={d}
      style={{ fill: seriesColor(color) }}
    />
  );
}

/** A labelled threshold across the plot, e.g. a latency budget, on the value axis. */
export function ReferenceLine({
  orientation,
  at,
  label,
  plot,
}: {
  /** "horizontal" draws a line across at y = at; "vertical" draws one down at x = at. */
  orientation: "horizontal" | "vertical";
  at: number;
  label: string;
  plot: PlotBox;
}) {
  if (orientation === "horizontal") {
    return (
      <g className="chart-reference">
        <line x1={plot.left} x2={plot.right} y1={f(at)} y2={f(at)} />
        <text x={plot.right} y={f(at - 6)} textAnchor="end">
          {label}
        </text>
      </g>
    );
  }
  const fitsRight = at + 6 + textWidth(label) <= plot.right;
  return (
    <g className="chart-reference">
      <line x1={f(at)} x2={f(at)} y1={plot.top} y2={plot.bottom} />
      <text
        x={f(fitsRight ? at + 6 : at - 6)}
        y={plot.top + CHART_FONT_SIZE}
        textAnchor={fitsRight ? "start" : "end"}
      >
        {label}
      </text>
    </g>
  );
}

export type AnnotationPlacement = "above-left" | "above-right" | "below-left" | "below-right";

/**
 * A callout on one data point: a ring around it and a label (with an optional quieter second
 * line). By default the label sits above and to the left, or to the right when there is no
 * room on the left; pass a placement to keep it clear of the lines.
 */
export function Annotation({
  x,
  y,
  label,
  note,
  placement,
  plot,
}: {
  x: number;
  y: number;
  label: string;
  note?: string;
  placement?: AnnotationPlacement;
  plot: PlotBox;
}) {
  const w = Math.max(textWidth(label), note ? textWidth(note, 11) : 0);
  const side = placement ?? (x - 12 - w >= plot.left ? "above-left" : "above-right");
  const toLeft = side.endsWith("left");
  const above = side.startsWith("above");
  const tx = toLeft ? x - 12 : x + 12;
  const anchor = toLeft ? "end" : "start";
  const block = note ? 14 + CHART_FONT_SIZE : CHART_FONT_SIZE;
  const ty = above
    ? Math.max(plot.top + CHART_FONT_SIZE, y - 12 - (block - CHART_FONT_SIZE))
    : Math.min(plot.bottom - (block - CHART_FONT_SIZE), y + 12 + CHART_FONT_SIZE);
  return (
    <g className="chart-annotation">
      <circle cx={f(x)} cy={f(y)} r={8} />
      <text x={f(tx)} y={f(ty)} textAnchor={anchor}>
        {label}
      </text>
      {note && (
        <text className="chart-annotation-note" x={f(tx)} y={f(ty + 14)} textAnchor={anchor}>
          {note}
        </text>
      )}
    </g>
  );
}
