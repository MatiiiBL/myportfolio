/*
 * Chart primitives (docs/site.md, section 6). Every chart on the site is built from these, so
 * they share one look: the figure panel, mono axis text, hairline gridlines, 2 px lines, bars
 * with a rounded data end, a legend for two or more series, a tooltip that follows the pointer,
 * a tap or the arrow keys, and a visually hidden data table for screen readers. Colors come only
 * from the tokens: series slots 1, 2, 3 (in that order) and "muted".
 *
 * The values below are placeholders for the shape of the props; real ones come from the
 * project's data files.
 *
 * A line chart (log y axis, a callout on one point, points with a note for the tooltip):
 *
 *   <LineChart
 *     title="SIFT1M: recall@10 against queries per second"
 *     subtitle="log scale · 1 thread · M=16, efC=200"
 *     x={{ type: "linear", label: "recall@10" }}
 *     y={{ type: "log", label: "queries/s" }}
 *     series={[
 *       { id: "vecdex", label: "vecdex", points: rows.map((r) => ({ x: r.recall, y: r.qps, note: `ef = ${r.ef}` })) },
 *       { id: "faiss", label: "FAISS HNSW", points: faissPoints },
 *     ]}
 *     annotations={[{ x: best.recall, y: best.qps, label: "1.78× FAISS", note: "at recall ≥ 0.95" }]}
 *     references={[{ value: budget, label: "budget" }]}
 *     caption={<>Up and to the right is better. Source: <a href={sourceUrl}>results.csv</a>.</>}
 *   />
 *
 * A bar chart (one series prints values at the tips; two or three series are grouped):
 *
 *   <BarChart
 *     title="Cycles per inference"
 *     categories={["CPU", "NPU"]}
 *     series={[{ id: "cycles", label: "Cycles", values: [cpuCycles, npuCycles] }]}
 *     value={{ type: "log", label: "cycles", format: (v) => formatNumber(v) }}
 *     emphasis={["NPU"]}
 *     caption="..."
 *   />
 *
 * Something custom: draw it inside ChartFrame with the same scales, axes and marks.
 *
 *   <ChartFrame
 *     title="..." height={280} table={{ columns: ["Step", "Value"], rows }}
 *     draw={({ width, height, active }) => {
 *       const plot = { left: 48, top: 12, right: width - 12, bottom: height - 26 };
 *       const x = numericScale({ type: "linear" }, [0, 10], [plot.left, plot.right]);
 *       ...
 *       return { marks: <>...<LineMark .../></>, stops };
 *     }}
 *   />
 *
 * A visualization that is not a chart (a diagram, a stepper) sits in <Figure> to match.
 */
export { ChartFrame, FALLBACK_WIDTH } from "./ChartFrame";
export type { ChartFrameProps, DrawContext, Drawing, Scan } from "./ChartFrame";
export { LineChart } from "./LineChart";
export type {
  ChartAnnotation,
  LineChartProps,
  LinePoint,
  LineSeries,
  Reference,
} from "./LineChart";
export { BarChart } from "./BarChart";
export type { BarChartProps, BarSeries } from "./BarChart";
export { XAxis, YAxis } from "./Axis";
export type { PlotBox } from "./Axis";
export { Annotation, Bar, Dot, LineMark, ReferenceLine } from "./marks";
export type { AnnotationPlacement } from "./marks";
export { Legend, SeriesKey } from "./Legend";
export { DataTable } from "./DataTable";
export {
  axisTicks,
  bandScale,
  formatCompact,
  formatNumber,
  numericScale,
  resolveDomain,
  textWidth,
  tickFormatter,
  tickLabelWidth,
  X_TICK_SPACING,
  Y_TICK_SPACING,
} from "./scales";
export type { NumericAxis, NumericScale } from "./scales";
export { barPath, nearestStop } from "./geometry";
export { defaultColor, seriesColor } from "./types";
export type {
  ChartTable,
  ChartText,
  LegendItem,
  SeriesColor,
  TooltipRow,
  TooltipStop,
} from "./types";
