// The intro's motion, as pure functions of the scroll progress p (0 at the top of the intro, 1
// where the hero unpins). Nothing here depends on time or on the previous frame, so scrolling
// back up replays every frame exactly in reverse.

export const STAGES = ["silicon", "robots", "models", "search"] as const;
export type Stage = (typeof STAGES)[number];

/**
 * Where each formation holds still, as [start, end] of p. Between two holds the particles fly
 * from one formation to the next; after the last hold they hand over to the hero's SVG.
 */
export const HOLDS: readonly (readonly [number, number])[] = [
  [0, 0.1],
  [0.28, 0.4],
  [0.58, 0.68],
  [0.86, 0.93],
];
/** The span of p over which the particles fade out and the hero's SVG fades in. */
export const HANDOVER: readonly [number, number] = [0.93, 1];

export interface Phase {
  /** The formation particles leave, and the one they fly to (the same while holding). */
  from: number;
  to: number;
  /** Progress of the flight, 0 to 1 (0 while holding). */
  t: number;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** The phase at progress p: holding a formation, or flying between two. */
export function phaseAt(p: number): Phase {
  const q = clamp01(p);
  for (let k = 0; k < HOLDS.length; k++) {
    const [start, end] = HOLDS[k] ?? [0, 0];
    if (q <= end) {
      if (q >= start || k === 0) return { from: k, to: k, t: 0 };
      const [, previousEnd] = HOLDS[k - 1] ?? [0, 0];
      return { from: k - 1, to: k, t: (q - previousEnd) / (start - previousEnd) };
    }
  }
  return { from: HOLDS.length - 1, to: HOLDS.length - 1, t: 0 };
}

/** The formation a visitor sees at p: the one the particles are closer to. */
export function stageAt(p: number): Stage {
  const { from, to, t } = phaseAt(p);
  return STAGES[t < 0.5 ? from : to] ?? "silicon";
}

/** How far the hand-over to the SVG has gone: 0 before it, 1 at the end of the intro. */
export function handoverAt(p: number): number {
  return smoothstep((clamp01(p) - HANDOVER[0]) / (HANDOVER[1] - HANDOVER[0]));
}

export function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

/**
 * A particle's own progress through a flight: it leaves after `delay` (0 to 1, scaled by
 * `spread`, the share of the flight particles may wait) and arrives by the end. Staggered
 * departures make a formation dissolve in a wave rather than all at once.
 */
export function stagger(t: number, delay: number, spread: number): number {
  return clamp01((t - delay * spread) / (1 - spread));
}

/** 0 at both ends of a flight and 1 halfway: how far a particle strays from the straight line. */
export function bump(t: number): number {
  return 4 * t * (1 - t);
}

export interface Flight {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Sideways bow of the path, as a share of its length (negative bows the other way). */
  arc: number;
  /** Turn about the swirl center halfway through the flight, in radians. */
  swirl: number;
  cx: number;
  cy: number;
}

/**
 * Where a particle is at eased progress e of its flight from a to b: on a bowed path, turned
 * about a center so the whole field swirls, and exactly at a when e = 0 and at b when e = 1.
 */
export function flightPoint(f: Flight, e: number, out: { x: number; y: number }): void {
  const dx = f.bx - f.ax;
  const dy = f.by - f.ay;
  const b = bump(e);
  // The straight path, bowed sideways along its normal.
  let x = f.ax + dx * e - dy * f.arc * b;
  let y = f.ay + dy * e + dx * f.arc * b;
  // The swirl: a turn about the center that grows and then unwinds.
  const angle = f.swirl * b;
  if (angle !== 0) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const rx = x - f.cx;
    const ry = y - f.cy;
    x = f.cx + rx * cos - ry * sin;
    y = f.cy + rx * sin + ry * cos;
  }
  out.x = x;
  out.y = y;
}
