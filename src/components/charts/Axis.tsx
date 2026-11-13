import { f } from "./geometry";
import { CHART_FONT_SIZE, textWidth, type NumericScale } from "./scales";

/** The plot area inside the SVG, in pixels. */
export interface PlotBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface AxisProps {
  scale: NumericScale;
  ticks: number[];
  format: (value: number) => string;
  plot: PlotBox;
  /** Axis title; the unit belongs in it. */
  label?: string;
  /** Draw a gridline at each tick across the plot (default true). */
  grid?: boolean;
}

/**
 * A horizontal value axis under the plot: hairline gridlines up through the plot, tick labels
 * below, and the title at the right end. `width` is the SVG width, so edge labels stay inside.
 */
export function XAxis({
  scale,
  ticks,
  format,
  plot,
  label,
  grid = true,
  width,
}: AxisProps & { width: number }) {
  const y = plot.bottom + CHART_FONT_SIZE + 6;
  return (
    <g className="chart-axis">
      {ticks.map((t) => {
        const x = scale(t);
        const text = format(t);
        const half = textWidth(text) / 2;
        const tx = Math.min(Math.max(x, half), width - half);
        return (
          <g key={t}>
            {grid && (
              <line className="chart-grid" x1={f(x)} x2={f(x)} y1={plot.top} y2={plot.bottom} />
            )}
            <text className="chart-tick" x={f(tx)} y={y} textAnchor="middle">
              {text}
            </text>
          </g>
        );
      })}
      <line
        className="chart-baseline"
        x1={plot.left}
        x2={plot.right}
        y1={plot.bottom}
        y2={plot.bottom}
      />
      {label && (
        <text className="chart-axis-label" x={width} y={y + CHART_FONT_SIZE + 8} textAnchor="end">
          {label} →
        </text>
      )}
    </g>
  );
}

/**
 * A vertical value axis left of the plot: hairline gridlines across the plot, tick labels at
 * the left, and the title above the plot's top-left corner, set horizontally so it reads easily.
 */
export function YAxis({ scale, ticks, format, plot, label, grid = true }: AxisProps) {
  return (
    <g className="chart-axis">
      {ticks.map((t) => {
        const y = scale(t);
        return (
          <g key={t}>
            {grid && (
              <line className="chart-grid" x1={plot.left} x2={plot.right} y1={f(y)} y2={f(y)} />
            )}
            <text className="chart-tick" x={plot.left - 8} y={f(y + 4)} textAnchor="end">
              {format(t)}
            </text>
          </g>
        );
      })}
      {label && (
        <text className="chart-axis-label" x={0} y={plot.top - 12}>
          ↑ {label}
        </text>
      )}
    </g>
  );
}
