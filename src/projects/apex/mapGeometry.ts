import { SPEED_BANDS, type Replay } from "./replay";

// World coordinates are meters with y up; the SVG flips y. Marks keep a constant on-screen size
// (non-scaling strokes, and cones drawn as round-capped zero-length segments) so the map reads
// the same on a phone and on a wide screen.

const PAD = 4;

/** A viewBox around every cone, with a margin. */
export function viewBox(replay: Replay): string {
  const xs = replay.cones.map((c) => c.x);
  const ys = replay.cones.map((c) => c.y);
  const minX = Math.min(...xs) - PAD;
  const maxX = Math.max(...xs) + PAD;
  const minY = Math.min(...ys) - PAD;
  const maxY = Math.max(...ys) + PAD;
  const f = (v: number) => v.toFixed(1);
  return `${f(minX)} ${f(-maxY)} ${f(maxX - minX)} ${f(maxY - minY)}`;
}

/** Points as round dots: a zero-length segment per point, drawn with a round cap. */
export function dots(points: { x: number; y: number }[]): string {
  return points.map((p) => `M${p.x.toFixed(2)} ${(-p.y).toFixed(2)}h0`).join("");
}

/** Points in the format of an SVG polyline's `points`. */
export function polyline(points: [number, number][]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${(-y).toFixed(2)}`).join(" ");
}

/** The speed bands as one hue, from faint (slow) to the full accent (fast). */
export function bandColor(band: number): string {
  const share = Math.round(30 + (70 * band) / (SPEED_BANDS.length - 1));
  return `color-mix(in oklab, var(--accent) ${share}%, var(--bg))`;
}
