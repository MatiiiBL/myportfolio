import type { TooltipStop } from "./types";

/** The stop nearest to a pointer position, measured along the chart's scan direction. */
export function nearestStop(
  stops: TooltipStop[],
  x: number,
  y: number,
  scan: "x" | "y" | "xy",
): number | null {
  let best: number | null = null;
  let bestDistance = Infinity;
  stops.forEach((stop, i) => {
    const dx = stop.x - x;
    const dy = stop.y - y;
    const d = scan === "x" ? Math.abs(dx) : scan === "y" ? Math.abs(dy) : Math.hypot(dx, dy);
    if (d < bestDistance) {
      bestDistance = d;
      best = i;
    }
  });
  return best;
}

/**
 * SVG path of a bar that grows from a baseline: square at the baseline, with rounded corners of
 * radius `r` at the data end. `from` is the baseline coordinate and `to` the data end along the
 * value axis; `start` and `thickness` place it across the other axis.
 */
export function barPath(
  orientation: "horizontal" | "vertical",
  from: number,
  to: number,
  start: number,
  thickness: number,
  r = 4,
): string {
  const length = Math.abs(to - from);
  if (length === 0) return "";
  const radius = Math.min(r, length, thickness / 2);
  const dir = to >= from ? 1 : -1;
  const end = to - dir * radius;
  if (orientation === "horizontal") {
    const y0 = start;
    const y1 = start + thickness;
    const sweep = dir === 1 ? 1 : 0;
    return [
      `M${f(from)},${f(y0)}`,
      `H${f(end)}`,
      `A${f(radius)},${f(radius)} 0 0 ${sweep} ${f(to)},${f(y0 + radius)}`,
      `V${f(y1 - radius)}`,
      `A${f(radius)},${f(radius)} 0 0 ${sweep} ${f(end)},${f(y1)}`,
      `H${f(from)}`,
      "Z",
    ].join("");
  }
  const x0 = start;
  const x1 = start + thickness;
  const sweep = dir === 1 ? 0 : 1;
  return [
    `M${f(x0)},${f(from)}`,
    `V${f(end)}`,
    `A${f(radius)},${f(radius)} 0 0 ${sweep} ${f(x0 + radius)},${f(to)}`,
    `H${f(x1 - radius)}`,
    `A${f(radius)},${f(radius)} 0 0 ${sweep} ${f(x1)},${f(end)}`,
    `V${f(from)}`,
    "Z",
  ].join("");
}

/** Rounds a coordinate to 0.01 px so paths stay short and identical on server and client. */
export function f(v: number): string {
  return Number.parseFloat(v.toFixed(2)).toString();
}
