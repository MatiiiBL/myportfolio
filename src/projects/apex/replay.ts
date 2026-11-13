// The recorded Apex run (data/replay.json, one `apex replay` of the mixed layout) and the
// queries the replay viewer makes of it: where the car is at time t, which cones the car has
// mapped by then, which path it is following, and which lap it is on.

import raw from "./data/replay.json";

export type ConeColor = 0 | 1 | 2;
export const CONE_COLORS: Record<ConeColor, string> = { 0: "blue", 1: "yellow", 2: "big orange" };

export type MissionState = "staged" | "exploring" | "map_finalized" | "racing" | "stopping";

export interface Lap {
  lap: number;
  /** Times the car crosses the timing line, in seconds since the run started. */
  start: number;
  end: number;
  /** The lap time the simulator's race monitor recorded. */
  time: number;
}

export interface Replay {
  dt: number;
  /** Pose and speed every dt seconds, in meters, radians and m/s. */
  x: Float64Array;
  y: Float64Array;
  yaw: Float64Array;
  speed: Float64Array;
  duration: number;
  transitions: { state: MissionState; t: number }[];
  laps: Lap[];
  /** The true cones: x, y, color. */
  cones: { x: number; y: number; color: ConeColor }[];
  /** The estimator's landmarks, in the order the car mapped them; `t` is when each appeared. */
  landmarks: { x: number; y: number; color: ConeColor; t: number }[];
  /** The open paths the controller followed (lap 1 and the stop), each from its time `t`. */
  paths: { t: number; points: [number, number][] }[];
  raceline: { t: number; points: [number, number][] };
  timingLine: [[number, number], [number, number]];
  summary: typeof raw.summary;
}

const MISSION_STATES: MissionState[] = [
  "staged",
  "exploring",
  "map_finalized",
  "racing",
  "stopping",
];

function pairs(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i + 1 < flat.length; i += 2)
    out.push([(flat[i] ?? 0) / 100, (flat[i + 1] ?? 0) / 100]);
  return out;
}

function asColor(c: number | undefined): ConeColor {
  return c === 1 || c === 2 ? c : 0;
}

function asState(s: string): MissionState {
  const state = MISSION_STATES.find((m) => m === s);
  if (!state) throw new Error(`unknown mission state ${s}`);
  return state;
}

/** Decodes the compact file: integers in cm, mrad, cm/s and deciseconds become SI floats. */
export function loadReplay(): Replay {
  const n = raw.x.length;
  const scaled = (values: number[], factor: number) => Float64Array.from(values, (v) => v * factor);
  const [tA, tB] = raw.timingLine;
  return {
    dt: raw.dt,
    x: scaled(raw.x, 0.01),
    y: scaled(raw.y, 0.01),
    yaw: scaled(raw.yaw, 0.001),
    speed: scaled(raw.speed, 0.01),
    duration: (n - 1) * raw.dt,
    transitions: raw.transitions.map((tr) => ({ state: asState(tr.state), t: tr.t })),
    laps: raw.laps,
    cones: raw.cones.map(([x = 0, y = 0, c]) => ({ x: x / 100, y: y / 100, color: asColor(c) })),
    landmarks: raw.landmarks.map(([x = 0, y = 0, c, t = 0]) => ({
      x: x / 100,
      y: y / 100,
      color: asColor(c),
      t: t / 10,
    })),
    paths: raw.paths.map((p) => ({ t: p.t, points: pairs(p.points) })),
    raceline: { t: raw.raceline.t, points: pairs(raw.raceline.points) },
    timingLine: [
      [(tA?.[0] ?? 0) / 100, (tA?.[1] ?? 0) / 100],
      [(tB?.[0] ?? 0) / 100, (tB?.[1] ?? 0) / 100],
    ],
    summary: raw.summary,
  };
}

export interface Pose {
  x: number;
  y: number;
  yaw: number;
  speed: number;
}

/** The car's pose at time t, linearly interpolated between samples. */
export function poseAt(replay: Replay, t: number): Pose {
  const u = Math.max(0, Math.min(replay.duration, t)) / replay.dt;
  const i = Math.min(Math.floor(u), replay.x.length - 1);
  const j = Math.min(i + 1, replay.x.length - 1);
  const w = u - i;
  const lerp = (a: Float64Array) => (a[i] ?? 0) + ((a[j] ?? 0) - (a[i] ?? 0)) * w;
  return { x: lerp(replay.x), y: lerp(replay.y), yaw: lerp(replay.yaw), speed: lerp(replay.speed) };
}

/** Index of the last sample at or before time t. */
export function sampleIndex(replay: Replay, t: number): number {
  return Math.max(0, Math.min(replay.x.length - 1, Math.floor(t / replay.dt + 1e-9)));
}

/** The mission state at time t. */
export function stateAt(replay: Replay, t: number): MissionState {
  let state: MissionState = "staged";
  for (const tr of replay.transitions) if (tr.t <= t) state = tr.state;
  return state;
}

/** The lap being driven at time t: null before the first crossing, the last lap after the end. */
export function lapAt(replay: Replay, t: number): Lap | null {
  const first = replay.laps[0];
  if (!first || t < first.start) return null;
  return replay.laps.find((lap) => t < lap.end) ?? null;
}

/** How many landmarks are in the map at time t (they are sorted by the time they appeared). */
export function mappedCount(replay: Replay, t: number): number {
  let lo = 0;
  let hi = replay.landmarks.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((replay.landmarks[mid]?.t ?? Infinity) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The open path the controller follows at time t, or null while it follows the raceline. */
export function pathAt(replay: Replay, t: number): [number, number][] | null {
  if (t >= replay.raceline.t && stateAt(replay, t) === "racing") return null;
  let current: [number, number][] | null = null;
  for (const p of replay.paths) if (p.t <= t) current = p.points;
  return current;
}

/** Speed bands for coloring the racing laps, in m/s: [lower, upper) per band. */
export const SPEED_BANDS: [number, number][] = [
  [0, 12],
  [12, 16],
  [16, 20],
  [20, 24],
  [24, 28],
  [28, Infinity],
];

export function speedBand(speed: number): number {
  const band = SPEED_BANDS.findIndex(([lo, hi]) => speed >= lo && speed < hi);
  return band < 0 ? 0 : band;
}

export interface TraceRun {
  band: number;
  points: [number, number][];
}

/**
 * The car's trace from t0 to t1, split into runs of one speed band. Consecutive runs share
 * their boundary point, so the colored line has no gaps.
 */
export function speedTrace(replay: Replay, t0: number, t1: number): TraceRun[] {
  const runs: TraceRun[] = [];
  const first = sampleIndex(replay, t0);
  const last = sampleIndex(replay, t1);
  let current: TraceRun | null = null;
  for (let i = first; i <= last; i++) {
    const p: [number, number] = [replay.x[i] ?? 0, replay.y[i] ?? 0];
    const band = speedBand(replay.speed[i] ?? 0);
    if (!current || current.band !== band) {
      if (current) current.points.push(p);
      current = { band, points: [p] };
      runs.push(current);
    } else {
      current.points.push(p);
    }
  }
  return runs;
}
