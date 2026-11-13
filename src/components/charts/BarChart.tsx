import { ChartFrame, type Drawing, type DrawContext } from "./ChartFrame";
import { XAxis, YAxis, type PlotBox } from "./Axis";
import { Bar, ReferenceLine } from "./marks";
import { f } from "./geometry";
import {
  axisTicks,
  bandScale,
  CHART_FONT_SIZE,
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
import type { Reference } from "./LineChart";

export interface BarSeries {
  /** Stable key, unique within the chart. */
  id: string;
  label: string;
  /** One value per category, in the order of `categories`; null where there is none. */
  values: (number | null)[];
  /** Defaults to the series' position: 1, 2, 3, then muted. */
  color?: SeriesColor;
}

export interface BarChartProps extends ChartText {
  categories: string[];
  /** One series draws simple bars; two or three draw grouped bars with a legend. */
  series: BarSeries[];
  /** The value axis. Linear axes start at zero; log axes start at their domain's minimum. */
  value: NumericAxis;
  /** Header of the category column in the data table (default "Category"). */
  categoryLabel?: string;
  /**
   * "horizontal" (the default) reads best with long names and on phones. "vertical" columns
   * switch to horizontal bars when their labels do not fit under them.
   */
  orientation?: "horizontal" | "vertical";
  /** Print each value at its bar's tip (default: on for one series, off for groups). */
  valueLabels?: boolean;
  /** Categories to keep in color; the others are drawn muted. Default: all in color. */
  emphasis?: string[];
  /** Labelled thresholds on the value axis. */
  references?: Reference[];
  /** Drawing height of vertical columns (default 300); horizontal bars size to their rows. */
  height?: number;
}

const GAP = 2;

/** Bars that grow from one baseline, one row (or column) per category. */
export function BarChart({
  title,
  subtitle,
  caption,
  categories,
  series,
  value,
  categoryLabel = "Category",
  orientation = "horizontal",
  valueLabels,
  emphasis,
  references = [],
  height = 300,
}: BarChartProps) {
  const colored = series.map((s, i) => ({ ...s, color: s.color ?? defaultColor(i) }));
  const format = value.format ?? formatNumber;
  const showValues = valueLabels ?? series.length === 1;
  const thickness = series.length === 1 ? 20 : 14;
  const groupSize = series.length * thickness + (series.length - 1) * GAP;
  const domain = resolveDomain(
    value,
    [
      ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
      ...references.map((r) => r.value),
    ],
    { includeZero: true },
  );
  const longestCategory = Math.max(0, ...categories.map((c) => textWidth(c)));
  const longestValue = showValues
    ? Math.max(
        0,
        ...series.flatMap((s) => s.values.map((v) => (v === null ? 0 : textWidth(format(v))))),
      )
    : 0;

  // Horizontal bars put each label beside its row, or above it when labels would take more
  // than about a third of the width (phones).
  const rowLayout = (width: number) => {
    const stacked = longestCategory + 12 > width * 0.36;
    const rowPitch = groupSize + (stacked ? 22 : 0) + 16;
    return { stacked, rowPitch, plotHeight: categories.length * rowPitch };
  };
  const horizontalHeight = (width: number) => {
    const top = value.label ? 30 : 8;
    return top + rowLayout(width).plotHeight + 26;
  };

  const colorOf = (s: (typeof colored)[number], category: string): SeriesColor =>
    emphasis && !emphasis.includes(category) ? "muted" : s.color;

  const rows = (i: number) =>
    colored.map((s) => {
      const v = s.values[i] ?? null;
      return {
        label: s.label,
        value: v === null ? "–" : format(v),
        color: colorOf(s, categories[i] ?? ""),
        mark: "bar" as const,
      };
    });

  const drawHorizontal = ({ width, active }: DrawContext): Drawing => {
    const { stacked, rowPitch, plotHeight } = rowLayout(width);
    const top = value.label ? 30 : 8;
    const left = stacked ? 0 : longestCategory + 12;
    const right = width - Math.max(8, showValues ? longestValue + 8 : 0);
    const plot: PlotBox = { left, top, right, bottom: top + plotHeight };
    const scale = numericScale(value, domain, [left, right]);
    const ticks = axisTicks(value, scale, right - left, X_TICK_SPACING);
    const base = value.type === "log" ? left : scale(0);
    const stops: TooltipStop[] = [];
    const marks = categories.map((category, i) => {
      const rowTop = top + i * rowPitch + 8 + (stacked ? 22 : 0);
      stops.push({ x: right, y: rowTop + groupSize / 2, title: category, rows: rows(i) });
      return (
        <g key={category}>
          <text
            className="chart-category"
            x={stacked ? 0 : left - 12}
            y={f(stacked ? rowTop - 8 : rowTop + groupSize / 2 + 4)}
            textAnchor={stacked ? "start" : "end"}
          >
            {category}
          </text>
          {colored.map((s, j) => {
            const v = s.values[i];
            if (v === null || v === undefined) return null;
            const start = rowTop + j * (thickness + GAP);
            const end = scale(v);
            return (
              <g key={s.id}>
                <Bar
                  orientation="horizontal"
                  from={base}
                  to={end}
                  start={start}
                  thickness={thickness}
                  color={colorOf(s, category)}
                  dimmed={active !== null && active !== i}
                />
                {showValues && (
                  <text className="chart-value" x={f(end + 6)} y={f(start + thickness / 2 + 4)}>
                    {format(v)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      );
    });
    return {
      stops,
      marks: (
        <>
          <XAxis
            scale={scale}
            ticks={ticks}
            format={tickFormatter(value, ticks)}
            plot={plot}
            width={width}
          />
          {value.label && (
            <text className="chart-axis-label" x={0} y={12}>
              {value.label} →
            </text>
          )}
          {references.map((r) => (
            <ReferenceLine
              key={r.label}
              orientation="vertical"
              at={scale(r.value)}
              label={r.label}
              plot={plot}
            />
          ))}
          {marks}
        </>
      ),
    };
  };

  const drawVertical = ({ width, height: h, active }: DrawContext): Drawing => {
    const top = (value.label ? 30 : 12) + (showValues ? 16 : 0);
    const bottom = h - 26;
    const scale = numericScale(value, domain, [bottom, top]);
    const ticks = axisTicks(value, scale, bottom - top, Y_TICK_SPACING);
    const tickFormat = tickFormatter(value, ticks);
    const left = tickLabelWidth(ticks, tickFormat) + 4;
    const right = width - 8;
    const plot: PlotBox = { left, top, right, bottom };
    const band = bandScale(categories, [left, right]);
    const barWidth = Math.min(24, (band.bandwidth() - (series.length - 1) * GAP) / series.length);
    const group = series.length * barWidth + (series.length - 1) * GAP;
    const base = value.type === "log" ? bottom : scale(0);
    const stops: TooltipStop[] = [];
    const marks = categories.map((category, i) => {
      const center = (band(category) ?? 0) + band.bandwidth() / 2;
      const values = colored.map((s) => s.values[i] ?? null);
      const tip = Math.min(...values.map((v) => (v === null ? base : scale(v))));
      stops.push({ x: center, y: tip, title: category, rows: rows(i) });
      return (
        <g key={category}>
          <text
            className="chart-category"
            x={f(center)}
            y={bottom + CHART_FONT_SIZE + 6}
            textAnchor="middle"
          >
            {category}
          </text>
          {colored.map((s, j) => {
            const v = s.values[i];
            if (v === null || v === undefined) return null;
            const start = center - group / 2 + j * (barWidth + GAP);
            const end = scale(v);
            return (
              <g key={s.id}>
                <Bar
                  orientation="vertical"
                  from={base}
                  to={end}
                  start={start}
                  thickness={barWidth}
                  color={colorOf(s, category)}
                  dimmed={active !== null && active !== i}
                />
                {showValues && (
                  <text
                    className="chart-value"
                    x={f(start + barWidth / 2)}
                    y={f(end - 6)}
                    textAnchor="middle"
                  >
                    {format(v)}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      );
    });
    return {
      stops,
      marks: (
        <>
          <YAxis scale={scale} ticks={ticks} format={tickFormat} plot={plot} label={value.label} />
          <line className="chart-baseline" x1={left} x2={right} y1={f(base)} y2={f(base)} />
          {references.map((r) => (
            <ReferenceLine
              key={r.label}
              orientation="horizontal"
              at={scale(r.value)}
              label={r.label}
              plot={plot}
            />
          ))}
          {marks}
        </>
      ),
    };
  };

  // Columns need their labels to fit under them; the frame's width is only known while drawing,
  // so the choice is made there and the height follows it.
  const columnsFit = (width: number) => {
    const plotWidth = width - 60;
    const step = plotWidth / Math.max(1, categories.length);
    return longestCategory + 8 <= step && (showValues ? longestValue <= step : true);
  };

  return (
    <ChartFrame
      title={title}
      subtitle={subtitle}
      caption={caption}
      height={(w) => (orientation === "vertical" && columnsFit(w) ? height : horizontalHeight(w))}
      legend={colored.map((s) => ({ label: s.label, color: s.color, mark: "bar" }))}
      table={barTable(categoryLabel, categories, series, format)}
      scan={orientation === "vertical" ? (w) => (columnsFit(w) ? "x" : "y") : "y"}
      draw={(context) =>
        orientation === "vertical" && columnsFit(context.width)
          ? drawVertical(context)
          : drawHorizontal(context)
      }
    />
  );
}

function barTable(
  categoryLabel: string,
  categories: string[],
  series: BarSeries[],
  format: (value: number) => string,
): ChartTable {
  return {
    columns: [categoryLabel, ...series.map((s) => s.label)],
    rows: categories.map((category, i) => [
      category,
      ...series.map((s) => {
        const v = s.values[i];
        return v === null || v === undefined ? "–" : format(v);
      }),
    ]),
  };
}
