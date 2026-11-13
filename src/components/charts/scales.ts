import { scaleBand, scaleLinear, scaleLog, type ScaleBand } from "d3-scale";

/** A numeric axis of a chart: its scale type, range of values, title and number format. */
export interface NumericAxis {
  /** "log" for data that spans orders of magnitude (throughput, latency). */
  type: "linear" | "log";
  /** [min, max]. Defaults to the data's extent; linear axes of bar charts always include 0. */
  domain?: [number, number];
  /** Axis title with its unit, e.g. "Queries per second" or "Latency (µs)". */
  label?: string;
  /** Formats a value for tooltips and the data table. Defaults to formatNumber. */
  format?: (value: number) => string;
  /** Formats tick labels. Defaults to a compact style (1K, 10K) once the ticks reach 10,000. */
  tickFormat?: (value: number) => string;
  /** Explicit tick values, when the automatic ones are not the meaningful ones. */
  ticks?: number[];
}

/** A scale that maps data values to pixels; d3's linear and log scales both fit. */
export interface NumericScale {
  (value: number): number;
  domain(): number[];
  range(): number[];
}

/** Builds a d3 linear or log scale for an axis. Linear domains are extended to round ticks. */
export function numericScale(
  axis: NumericAxis,
  domain: [number, number],
  range: [number, number],
): NumericScale {
  if (axis.type === "log") {
    if (domain[0] <= 0) throw new Error(`A log axis needs a positive domain, got ${domain[0]}`);
    return scaleLog().domain(domain).range(range);
  }
  const scale = scaleLinear().domain(domain).range(range);
  return axis.domain ? scale : scale.nice(tickCount(Math.abs(range[1] - range[0])));
}

/** A band scale for categories, with the padding the bar marks expect. */
export function bandScale(categories: string[], range: [number, number]): ScaleBand<string> {
  return scaleBand<string>().domain(categories).range(range).paddingInner(0.3).paddingOuter(0.15);
}

/** The domain an axis should span: the explicit one, else the data's extent. */
export function resolveDomain(
  axis: NumericAxis,
  values: number[],
  options: { includeZero?: boolean } = {},
): [number, number] {
  if (axis.domain) return axis.domain;
  const finite = values.filter((v) => Number.isFinite(v) && (axis.type === "linear" || v > 0));
  if (finite.length === 0) return axis.type === "log" ? [1, 10] : [0, 1];
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (axis.type === "linear" && options.includeZero) {
    min = Math.min(0, min);
    max = Math.max(0, max);
  }
  if (min === max) {
    if (axis.type === "log") return [min / 10, max * 10];
    return min === 0 ? [0, 1] : [Math.min(0, min), Math.max(0, max)];
  }
  // A log axis has no zero, so bars start at the power of ten below the smallest value; a bar
  // drawn from the smallest value itself would have no length.
  if (axis.type === "log" && options.includeZero) {
    const floor = 10 ** Math.floor(Math.log10(min));
    min = floor === min ? floor / 10 : floor;
  }
  return [min, max];
}

/** Pixels per tick: labels along x sit side by side and need more room than stacked y labels. */
export const X_TICK_SPACING = 80;
export const Y_TICK_SPACING = 52;

/** One tick per `spacing` pixels, never fewer than two. */
export function tickCount(pixels: number, spacing = 64): number {
  return Math.max(2, Math.floor(pixels / spacing));
}

/**
 * Tick values for a numeric axis spanning `pixels`, about one per `spacing` pixels (wider along
 * x, where labels sit side by side). Log axes show powers of ten when the domain spans two or
 * more decades, and the 1-2-5 sequence when it spans less, so labels never crowd.
 */
export function axisTicks(
  axis: NumericAxis,
  scale: NumericScale,
  pixels: number,
  spacing = 64,
): number[] {
  if (axis.ticks) return axis.ticks;
  const [d0, d1] = scale.domain() as [number, number];
  const lo = Math.min(d0, d1);
  const hi = Math.max(d0, d1);
  if (axis.type === "log") {
    const decades = Math.log10(hi / lo);
    const allowed = decades >= 2 ? [1] : decades >= 1 ? [1, 2, 5] : [1, 1.5, 2, 3, 5, 7];
    const ticks: number[] = [];
    for (let e = Math.floor(Math.log10(lo)); e <= Math.ceil(Math.log10(hi)); e++) {
      for (const m of allowed) {
        const v = roundFloat(m * 10 ** e);
        if (v >= lo * (1 - 1e-9) && v <= hi * (1 + 1e-9)) ticks.push(v);
      }
    }
    const maxTicks = tickCount(pixels, spacing) + 1;
    if (ticks.length <= maxTicks) return ticks;
    const powers = ticks.filter((t) => Number.isInteger(Math.log10(t)));
    if (powers.length >= 2 && powers.length <= maxTicks) return powers;
    const stride = Math.ceil(ticks.length / maxTicks);
    return ticks.filter((_, i) => i % stride === 0);
  }
  return scaleLinear().domain([lo, hi]).ticks(tickCount(pixels, spacing));
}

/** Removes binary floating-point noise (0.30000000000000004) from a computed tick. */
function roundFloat(v: number): number {
  return Number.parseFloat(v.toPrecision(12));
}

const fullNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
const smallNumber = new Intl.NumberFormat("en-US", { maximumSignificantDigits: 3 });

/**
 * Formats a value in full for tooltips and tables: grouped thousands, at most two decimals,
 * three significant digits below 1 (18,034 · 2.86 · 0.0042). Pass a format of your own when a
 * value needs a unit or a fixed precision.
 */
export function formatNumber(value: number): string {
  if (value !== 0 && Math.abs(value) < 1) return smallNumber.format(value);
  return fullNumber.format(value);
}

/** Compact style for axis ticks that reach 10,000: 10K, 250K, 1.5M. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e3) return `${trim(value / 1e3)}K`;
  return formatNumber(value);
}

function trim(v: number): string {
  return Number.parseFloat(v.toFixed(1)).toString();
}

/** One tick style per axis: in full below 10,000, compact once any tick reaches it. */
export function tickFormatter(axis: NumericAxis, ticks: number[]): (value: number) => string {
  if (axis.tickFormat) return axis.tickFormat;
  return ticks.some((t) => Math.abs(t) >= 1e4) ? formatCompact : formatNumber;
}

/** Pixel size of chart text. Chart text is set in JetBrains Mono, whose glyphs are 0.6 em wide. */
export const CHART_FONT_SIZE = 12;
const MONO_ADVANCE = 0.6;

/**
 * Width of a string of chart text in pixels. Because the chart face is monospaced this is exact
 * without measuring the DOM, so the prerendered layout matches the client's.
 */
export function textWidth(text: string, fontSize = CHART_FONT_SIZE): number {
  return [...text].length * fontSize * MONO_ADVANCE;
}

/** Width the left margin needs for a set of tick labels. */
export function tickLabelWidth(ticks: number[], format: (value: number) => string): number {
  return Math.max(0, ...ticks.map((t) => textWidth(format(t)))) + 8;
}
