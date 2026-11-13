import { ChartFrame, type Drawing, type DrawContext } from "./ChartFrame";
import { XAxis, YAxis, type PlotBox } from "./Axis";
import { Annotation, Dot, LineMark, ReferenceLine, type AnnotationPlacement } from "./marks";
import { f } from "./geometry";
import {
  axisTicks,
  formatNumber,
  numericScale,
  resolveDomain,
  textWidth,
  tickFormatter,
  tickLabelWidth,
  X_TICK_SPACING,
  Y_TICK_SPACING,
  type NumericAxis,
} from "./scales";
import {
  defaultColor,
  type ChartTable,
  type ChartText,
  type SeriesColor,
  type TooltipStop,
} from "./types";

export interface LinePoint {
  x: number;
  y: number;
  /** Extra context for this point in the tooltip and table, e.g. "ef = 64". */
  note?: string;
}

export interface LineSeries {
  /** Stable key, unique within the chart. */
  id: string;
  label: string;
  points: LinePoint[];
  /** Defaults to the series' position: 1, 2, 3, then muted. */
  color?: SeriesColor;
  /** Dot every point; defaults to true for up to 24 points. */
  markers?: boolean;
}

/** A labelled threshold on the y axis, e.g. { value: 2000, label: "budget 2 ms" }. */
export interface Reference {
  value: number;
  label: string;
}

/** A callout on one point: a ring around it and a label, e.g. "1.78× FAISS". */
export interface ChartAnnotation {
  x: number;
  y: number;
  label: string;
  /** A second, quieter line under the label. */
  note?: string;
  /** Where the label sits relative to the point (default above-left, or above-right at the edge). */
  placement?: AnnotationPlacement;
}

export interface LineChartProps extends ChartText {
  series: LineSeries[];
  x: NumericAxis;
  y: NumericAxis;
  /** Drawing height in pixels, axes included (default 300). */
  height?: number;
  /** Label each line at its last point, beside the legend; skipped when the ends collide. */
  endLabels?: boolean;
  references?: Reference[];
  annotations?: ChartAnnotation[];
}

/**
 * Lines over a numeric x axis. When every series shares the same x values the tooltip is a
 * crosshair listing all of them at that x; otherwise it moves between individual points.
 */
export function LineChart({
  title,
  subtitle,
  caption,
  series,
  x,
  y,
  height = 300,
  endLabels = false,
  references = [],
  annotations = [],
}: LineChartProps) {
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? defaultColor(i) }));
  const shared = sharesX(series);
  const xFormat = x.format ?? formatNumber;
  const yFormat = y.format ?? formatNumber;

  const draw = ({ width, height: h, active }: DrawContext): Drawing => {
    const top = y.label ? 30 : 12;
    const bottom = h - (x.label ? 44 : 26);
    const yScale = numericScale(
      y,
      resolveDomain(y, [
        ...series.flatMap((s) => s.points.map((p) => p.y)),
        ...references.map((r) => r.value),
      ]),
      [bottom, top],
    );
    const yTicks = axisTicks(y, yScale, bottom - top, Y_TICK_SPACING);
    const yTickFormat = tickFormatter(y, yTicks);
    const left = tickLabelWidth(yTicks, yTickFormat) + 4;
    const labelRoom = endLabels ? Math.max(...series.map((s) => textWidth(s.label))) + 14 : 0;
    const right = width - Math.max(12, labelRoom);
    const xScale = numericScale(
      x,
      resolveDomain(
        x,
        series.flatMap((s) => s.points.map((p) => p.x)),
      ),
      [left, right],
    );
    const xTicks = axisTicks(x, xScale, right - left, X_TICK_SPACING);
    const plot: PlotBox = { left, top, right, bottom };

    const stops = shared ? sharedStops() : pointStops();
    function sharedStops(): TooltipStop[] {
      const xs = (series[0]?.points ?? []).map((p) => p.x);
      return xs.map((xv, i) => ({
        x: xScale(xv),
        y: Math.min(...colored.map((s) => yScale(s.points[i]?.y ?? 0))),
        title: titleFor(xv, series[0]?.points[i]?.note),
        rows: colored.map((s) => ({
          label: s.label,
          value: yFormat(s.points[i]?.y ?? 0),
          color: s.color,
          mark: "line" as const,
        })),
      }));
    }
    function pointStops(): TooltipStop[] {
      return colored
        .flatMap((s) => s.points.map((p) => ({ s, p })))
        .sort((a, b) => a.p.x - b.p.x)
        .map(({ s, p }) => ({
          x: xScale(p.x),
          y: yScale(p.y),
          title: titleFor(p.x, p.note),
          rows: [{ label: s.label, value: yFormat(p.y), color: s.color, mark: "line" as const }],
        }));
    }
    function titleFor(xv: number, note?: string) {
      const head = x.label ? `${x.label} ${xFormat(xv)}` : xFormat(xv);
      return note ? `${head} · ${note}` : head;
    }

    const current = active === null ? undefined : stops[active];
    const ends = colored
      .map((s) => {
        const last = s.points[s.points.length - 1];
        return last ? { label: s.label, x: xScale(last.x), y: yScale(last.y) } : null;
      })
      .filter((e) => e !== null)
      .sort((a, b) => a.y - b.y);
    const endsFit = ends.every((e, i) => i === 0 || e.y - (ends[i - 1]?.y ?? 0) >= 14);

    return {
      stops,
      marks: (
        <>
          <YAxis scale={yScale} ticks={yTicks} format={yTickFormat} plot={plot} label={y.label} />
          <XAxis
            scale={xScale}
            ticks={xTicks}
            format={tickFormatter(x, xTicks)}
            plot={plot}
            label={x.label}
            width={width}
          />
          {references.map((r) => (
            <ReferenceLine
              key={r.label}
              orientation="horizontal"
              at={yScale(r.value)}
              label={r.label}
              plot={plot}
            />
          ))}
          {shared && current && (
            <line
              className="chart-crosshair"
              x1={f(current.x)}
              x2={f(current.x)}
              y1={top}
              y2={bottom}
            />
          )}
          {colored.map((s) => (
            <LineMark
              key={s.id}
              color={s.color}
              points={s.points.map((p) => [xScale(p.x), yScale(p.y)])}
            />
          ))}
          {colored.map((s) =>
            (s.markers ?? s.points.length <= 24)
              ? s.points.map((p) => (
                  <Dot key={`${s.id}-${p.x}`} x={xScale(p.x)} y={yScale(p.y)} color={s.color} />
                ))
              : null,
          )}
          {current &&
            (shared ? (
              colored.map((s) => {
                const p = s.points[active ?? 0];
                return p ? (
                  <Dot
                    key={`active-${s.id}`}
                    x={xScale(p.x)}
                    y={yScale(p.y)}
                    color={s.color}
                    r={5}
                  />
                ) : null;
              })
            ) : (
              <circle className="chart-focus-ring" cx={f(current.x)} cy={f(current.y)} r={8} />
            ))}
          {annotations.map((a) => (
            <Annotation
              key={a.label}
              x={xScale(a.x)}
              y={yScale(a.y)}
              label={a.label}
              note={a.note}
              placement={a.placement}
              plot={plot}
            />
          ))}
          {endLabels &&
            endsFit &&
            ends.map((e) => (
              <text key={e.label} className="chart-end-label" x={f(e.x + 8)} y={f(e.y + 4)}>
                {e.label}
              </text>
            ))}
        </>
      ),
    };
  };

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      caption={caption}
      height={height}
      legend={colored.map((s) => ({ label: s.label, color: s.color, mark: "line" }))}
      table={lineTable(series, x, y, shared)}
      scan={shared ? "x" : "xy"}
      draw={draw}
    />
  );
}

/** True when every series has points at the same x values, in the same order. */
function sharesX(series: LineSeries[]): boolean {
  const first = series[0]?.points.map((p) => p.x) ?? [];
  return series.every(
    (s) => s.points.length === first.length && s.points.every((p, i) => p.x === first[i]),
  );
}

function lineTable(
  series: LineSeries[],
  x: NumericAxis,
  y: NumericAxis,
  shared: boolean,
): ChartTable {
  const xFormat = x.format ?? formatNumber;
  const yFormat = y.format ?? formatNumber;
  const notes = series.some((s) => s.points.some((p) => p.note));
  if (shared) {
    const first = series[0]?.points ?? [];
    return {
      columns: [x.label ?? "x", ...series.map((s) => s.label), ...(notes ? ["Note"] : [])],
      rows: first.map((p, i) => [
        xFormat(p.x),
        ...series.map((s) => {
          const v = s.points[i]?.y;
          return v === undefined ? "–" : yFormat(v);
        }),
        ...(notes ? [p.note ?? ""] : []),
      ]),
    };
  }
  return {
    columns: ["Series", x.label ?? "x", y.label ?? "y", ...(notes ? ["Note"] : [])],
    rows: series.flatMap((s) =>
      s.points.map((p) => [s.label, xFormat(p.x), yFormat(p.y), ...(notes ? [p.note ?? ""] : [])]),
    ),
  };
}
