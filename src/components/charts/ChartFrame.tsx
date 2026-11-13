import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Figure } from "../Figure";
import { Legend } from "./Legend";
import { Tooltip } from "./Tooltip";
import { DataTable } from "./DataTable";
import { useWidth } from "./useWidth";
import { nearestStop } from "./geometry";
import type { ChartTable, ChartText, LegendItem, TooltipStop } from "./types";
import "./charts.css";

/** Width the chart is drawn at before it can measure its container (prerender, first paint). */
export const FALLBACK_WIDTH = 720;

export interface DrawContext {
  /** Drawing size in pixels; the SVG maps one unit to one CSS pixel. */
  width: number;
  height: number;
  /** Index into the returned stops of the position the tooltip is on, or null. */
  active: number | null;
}

export interface Drawing {
  /** The SVG content: axes, gridlines and marks. */
  marks: ReactNode;
  /** Where the tooltip can stop, in reading order (left to right, or top to bottom). */
  stops: TooltipStop[];
}

/**
 * How the pointer picks a stop: the nearest along x (line charts, columns), along y (horizontal
 * bars) or in both (scatter).
 */
export type Scan = "x" | "y" | "xy";

export interface ChartFrameProps extends ChartText {
  /** Height of the drawing in pixels, axes included; a function when it depends on the width. */
  height: number | ((width: number) => number);
  /** Shown above the plot when there are two or more series. */
  legend?: LegendItem[];
  /** The chart's data, for screen readers. */
  table: ChartTable;
  scan?: Scan | ((width: number) => Scan);
  /** Draws the chart at the measured width. Called on every render, so keep it pure. */
  draw: (context: DrawContext) => Drawing;
}

/**
 * The frame every chart is drawn in: the figure panel, the legend, a responsive SVG, a tooltip
 * that follows the pointer or the arrow keys, and a visually hidden data table.
 */
export function ChartFrame({
  title,
  subtitle,
  caption,
  height: heightFor,
  legend,
  table,
  scan: scanFor = "x",
  draw,
}: ChartFrameProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const width = useWidth(plotRef, FALLBACK_WIDTH);
  const [active, setActive] = useState<number | null>(null);
  const hintId = `${useId()}hint`;

  const height = typeof heightFor === "function" ? heightFor(width) : heightFor;
  const scan = typeof scanFor === "function" ? scanFor(width) : scanFor;
  const { marks, stops } = draw({ width, height, active });
  const current = active === null ? undefined : stops[active];

  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const svg = event.currentTarget.querySelector("svg");
    if (!svg || stops.length === 0) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * width) / rect.width;
    const y = ((event.clientY - rect.top) * height) / rect.height;
    setActive(nearestStop(stops, x, y, scan));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (stops.length === 0) return;
    const last = stops.length - 1;
    const next: Record<string, number | null> = {
      ArrowRight: active === null ? 0 : Math.min(last, active + 1),
      ArrowDown: active === null ? 0 : Math.min(last, active + 1),
      ArrowLeft: active === null ? last : Math.max(0, active - 1),
      ArrowUp: active === null ? last : Math.max(0, active - 1),
      Home: 0,
      End: last,
      Escape: null,
    };
    if (!(event.key in next)) return;
    event.preventDefault();
    setActive(next[event.key] ?? null);
  };

  return (
    <Figure title={title} subtitle={subtitle} caption={caption}>
      {legend && legend.length > 1 && <Legend items={legend} />}
      <div
        ref={plotRef}
        className="chart-plot"
        role="group"
        aria-label={`${title}, interactive chart`}
        aria-describedby={hintId}
        tabIndex={0}
        onPointerMove={pick}
        onPointerDown={pick}
        onPointerLeave={(event) => {
          if (event.pointerType !== "touch") setActive(null);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((a) => a ?? 0)}
        onBlur={() => setActive(null)}
      >
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          height={height}
          preserveAspectRatio="xMinYMin meet"
          aria-hidden="true"
          focusable="false"
        >
          {marks}
        </svg>
        {current && <Tooltip stop={current} width={width} height={height} />}
      </div>
      <p id={hintId} className="visually-hidden">
        Use the arrow keys to step through the values. The same data is in the table that follows.
      </p>
      <p className="visually-hidden" aria-live="polite">
        {current
          ? `${current.title}: ${current.rows.map((r) => `${r.label} ${r.value}`).join(", ")}`
          : ""}
      </p>
      <DataTable title={title} table={table} />
    </Figure>
  );
}
