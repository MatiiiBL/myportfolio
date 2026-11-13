import { useRef } from "react";
import {
  axisTicks,
  LineMark,
  Legend,
  numericScale,
  ReferenceLine,
  tickFormatter,
  XAxis,
  X_TICK_SPACING,
  YAxis,
  Y_TICK_SPACING,
  type PlotBox,
  type SeriesColor,
} from "../../components/charts";
import { useWidth } from "../../components/charts/useWidth";

export interface LiveSeries {
  label: string;
  color: SeriesColor;
  /** One value per second of simulated time. */
  values: number[];
}

interface LiveChartProps {
  title: string;
  yLabel: string;
  series: LiveSeries[];
  /** Simulated seconds shown so far. */
  upTo: number;
  /** Simulated seconds the x axis spans. */
  duration: number;
  yMax: number;
  references?: { value: number; label: string }[];
  /** A vertical marker in simulated seconds, e.g. the kill. */
  marker?: { at: number; label: string } | null;
}

const HEIGHT = 190;

/** A small line chart over simulated minutes that grows as the run plays. */
export function LiveChart({
  title,
  yLabel,
  series,
  upTo,
  duration,
  yMax,
  references = [],
  marker = null,
}: LiveChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref, 480);
  const minutes = duration / 60;
  const xAxis = {
    type: "linear" as const,
    label: "simulated minutes",
    domain: [0, minutes] as [number, number],
  };
  const yAxis = { type: "linear" as const, domain: [0, yMax] as [number, number] };
  const top = 26;
  const bottom = HEIGHT - 40;
  const y = numericScale(yAxis, [0, yMax], [bottom, top]);
  const yTicks = axisTicks(yAxis, y, bottom - top, Y_TICK_SPACING);
  const yFormat = tickFormatter(yAxis, yTicks);
  const left = 40;
  const right = width - 8;
  const x = numericScale(xAxis, [0, minutes], [left, right]);
  const xTicks = axisTicks(xAxis, x, right - left, X_TICK_SPACING);
  const plot: PlotBox = { left, top, right, bottom };
  const last = Math.max(0, Math.min(Math.floor(upTo), duration));

  return (
    <div className="live-chart">
      <p className="live-title">{title}</p>
      {series.length > 1 && (
        <Legend items={series.map((s) => ({ label: s.label, color: s.color, mark: "line" }))} />
      )}
      <div ref={ref}>
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${HEIGHT}`}
          width="100%"
          height={HEIGHT}
          aria-hidden="true"
          focusable="false"
        >
          <YAxis scale={y} ticks={yTicks} format={yFormat} plot={plot} label={yLabel} />
          <XAxis
            scale={x}
            ticks={xTicks}
            format={tickFormatter(xAxis, xTicks)}
            plot={plot}
            label={xAxis.label}
            width={width}
            grid={false}
          />
          {references.map((r) => (
            <ReferenceLine
              key={r.label}
              orientation="horizontal"
              at={y(r.value)}
              label={r.label}
              plot={plot}
            />
          ))}
          {marker && marker.at <= upTo && (
            <ReferenceLine
              orientation="vertical"
              at={x(marker.at / 60)}
              label={marker.label}
              plot={plot}
            />
          )}
          {series.map((s) => (
            <LineMark
              key={s.label}
              color={s.color}
              points={s.values
                .slice(0, last + 1)
                .map((v, i) => [x(i / 60), y(Math.min(v, yMax))] as [number, number])}
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
