import type { ReactNode } from "react";
import {
  ChartFrame,
  ReferenceLine,
  XAxis,
  axisTicks,
  numericScale,
  seriesColor,
  textWidth,
  tickFormatter,
  X_TICK_SPACING,
  type NumericAxis,
  type PlotBox,
  type TooltipStop,
} from "../../components/charts";

export interface FmaxStep {
  step: number;
  change: string;
  short: string;
  fmaxMin: number;
  fmaxMax: number;
}

interface FmaxChartProps {
  steps: FmaxStep[];
  /** The clock the board runs at, drawn as a reference line. */
  targetMHz: number;
  caption: ReactNode;
}

const AXIS: NumericAxis = { type: "linear", domain: [20, 50], label: "Fmax (MHz)" };
const THICKNESS = 12;

function f(v: number): string {
  return Number.parseFloat(v.toFixed(2)).toString();
}

/**
 * Fmax after each timing-closure step, as the range over the place-and-route seeds: a range is
 * what nextpnr gives, so a single number per step would overstate its precision.
 */
export function FmaxChart({ steps, targetMHz, caption }: FmaxChartProps) {
  const labels = steps.map((s) => `${s.step}  ${s.short}`);
  const longest = Math.max(...labels.map((l) => textWidth(l)));
  const layout = (width: number) => {
    const stacked = longest + 12 > width * 0.36;
    const pitch = THICKNESS + 16 + (stacked ? 22 : 0);
    return { stacked, pitch, top: 30, plotHeight: steps.length * pitch };
  };
  const range = (s: FmaxStep) => `${s.fmaxMin.toFixed(1)}–${s.fmaxMax.toFixed(1)} MHz`;

  return (
    <ChartFrame
      title="Fmax after each timing-closure step"
      subtitle="nextpnr, LFE5U-85F speed grade 6 · range over place-and-route seeds"
      caption={caption}
      height={(w) => {
        const l = layout(w);
        return l.top + l.plotHeight + 26;
      }}
      scan="y"
      table={{
        columns: ["Step", "Change", "Fmax (MHz)"],
        rows: steps.map((s) => [String(s.step), s.change, range(s)]),
      }}
      draw={({ width, active }) => {
        const { stacked, pitch, top, plotHeight } = layout(width);
        const left = stacked ? 0 : longest + 12;
        const right = width - 8;
        const plot: PlotBox = { left, top, right, bottom: top + plotHeight };
        const scale = numericScale(AXIS, AXIS.domain ?? [20, 50], [left, right]);
        const ticks = axisTicks(AXIS, scale, right - left, X_TICK_SPACING);
        const stops: TooltipStop[] = [];
        const rows = steps.map((s, i) => {
          const rowTop = top + i * pitch + 8 + (stacked ? 22 : 0);
          const x0 = scale(s.fmaxMin);
          const x1 = scale(s.fmaxMax);
          stops.push({
            x: x1,
            y: rowTop + THICKNESS / 2,
            title: `Step ${s.step}: ${s.change}`,
            rows: [{ label: "Fmax", value: range(s), color: 1, mark: "bar" }],
          });
          return (
            <g key={s.step}>
              <text
                className="chart-category"
                x={stacked ? 0 : left - 12}
                y={f(stacked ? rowTop - 8 : rowTop + THICKNESS / 2 + 4)}
                textAnchor={stacked ? "start" : "end"}
              >
                {labels[i]}
              </text>
              <rect
                className={active !== null && active !== i ? "chart-bar is-dimmed" : "chart-bar"}
                x={f(x0)}
                y={f(rowTop)}
                width={f(Math.max(THICKNESS, x1 - x0))}
                height={THICKNESS}
                rx={4}
                style={{ fill: seriesColor(1) }}
              />
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
                format={tickFormatter(AXIS, ticks)}
                plot={plot}
                width={width}
              />
              <text className="chart-axis-label" x={0} y={12}>
                {AXIS.label} →
              </text>
              <ReferenceLine
                orientation="vertical"
                at={scale(targetMHz)}
                label={`${targetMHz} MHz clock`}
                plot={plot}
              />
              {rows}
            </>
          ),
        };
      }}
    />
  );
}
