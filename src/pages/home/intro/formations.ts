import { mulberry32 } from "../../../lib/hnsw/points";

// The four formations the particle field takes, each built from a real project. Every generator
// is deterministic: the same particle count gives the same formation on every render.

/** Palette slots; the engine reads their colors from the design tokens. */
export const COLOR = {
  dim: 0, // --text-3
  accent: 1, // --accent
  gold: 2, // --series-1
  blue: 3, // --series-2
  green: 4, // --series-3
  faint: 5, // --border
  bright: 6, // --text
} as const;
export const PALETTE_SIZE = 7;

/** What a particle does while its formation holds still. */
export const MOTION = {
  none: 0,
  /** Silicon: a processing element, brightened when the compute wavefront passes it. */
  cell: 1,
  /** Silicon: an operand flowing along its lane into the array. */
  lane: 2,
  /** Robots: part of the car or of its trail, moving round the lap. */
  car: 3,
} as const;

export interface Formation {
  count: number;
  /** Positions: in the formation's unit square (y down) for the first three, in pixels for search. */
  x: Float32Array;
  y: Float32Array;
  color: Uint8Array;
  /** Base opacity and radius multiplier. */
  alpha: Float32Array;
  size: Float32Array;
  motion: Uint8Array;
  /** Per-particle data for its motion: the cell or lane index, or the car slot. */
  slot: Float32Array;
  /** Width over height of the unit square's content, for fitting it to the screen. */
  aspect: number;
}

function empty(count: number, aspect: number): Formation {
  return {
    count,
    x: new Float32Array(count),
    y: new Float32Array(count),
    color: new Uint8Array(count),
    alpha: new Float32Array(count),
    size: new Float32Array(count),
    motion: new Uint8Array(count),
    slot: new Float32Array(count),
    aspect,
  };
}

/**
 * Splits `total` items among parts in proportion to their weights, by largest remainder, so the
 * shares always add up to exactly `total`.
 */
export function apportion(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) return weights.map(() => 0);
  const exact = weights.map((w) => (w / sum) * total);
  const shares = exact.map(Math.floor);
  const order = exact
    .map((v, i) => ({ i, rest: v - Math.floor(v) }))
    .sort((a, b) => b.rest - a.rest || a.i - b.i);
  let left = total - shares.reduce((a, b) => a + b, 0);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i] = (shares[i] ?? 0) + 1;
    left--;
  }
  return shares;
}

// ---------------------------------------------------------------------------------------------
// 1. Silicon: Pulse's 8 × 8 systolic array.

export const ARRAY_SIZE = 8;
const GRID_LEFT = 0.16;
const GRID_TOP = 0.16;
const PITCH = (1 - GRID_TOP - 0.02) / ARRAY_SIZE;
const CELL = PITCH * 0.68;

/** The center of processing element (row, col) in the silicon formation's unit square. */
export function cellCenter(row: number, col: number): { x: number; y: number } {
  return { x: GRID_LEFT + (col + 0.5) * PITCH, y: GRID_TOP + (row + 0.5) * PITCH };
}

/**
 * The array as particles: each processing element is a small square outline, and operand lanes
 * lead into it from the left (A, one per row) and from the top (B, one per column).
 */
export function siliconFormation(count: number): Formation {
  const f = empty(count, 1);
  const cells = ARRAY_SIZE * ARRAY_SIZE;
  const [inCells = 0, inLanes = 0] = apportion(count, [0.68, 0.32]);
  const perCell = apportion(inCells, Array<number>(cells).fill(1));
  const perLane = apportion(inLanes, Array<number>(2 * ARRAY_SIZE).fill(1));
  let i = 0;
  for (let c = 0; c < cells; c++) {
    const row = Math.floor(c / ARRAY_SIZE);
    const col = c % ARRAY_SIZE;
    const center = cellCenter(row, col);
    const k = perCell[c] ?? 0;
    for (let j = 0; j < k; j++) {
      // Walk the square's perimeter: 4 sides of length CELL, starting at the top-left corner.
      const along = (j / k) * 4;
      const side = Math.floor(along);
      const s = (along - side) * CELL - CELL / 2;
      const h = CELL / 2;
      const [dx, dy] = side === 0 ? [s, -h] : side === 1 ? [h, s] : side === 2 ? [-s, h] : [-h, -s];
      f.x[i] = center.x + dx;
      f.y[i] = center.y + dy;
      f.color[i] = COLOR.dim;
      f.alpha[i] = 0.55;
      f.size[i] = 1;
      f.motion[i] = MOTION.cell;
      f.slot[i] = c;
      i++;
    }
  }
  for (let lane = 0; lane < 2 * ARRAY_SIZE; lane++) {
    const k = perLane[lane] ?? 0;
    for (let j = 0; j < k; j++) {
      f.x[i] = 0;
      f.y[i] = 0;
      f.color[i] = lane < ARRAY_SIZE ? COLOR.blue : COLOR.green;
      f.alpha[i] = 0.75;
      f.size[i] = 0.9;
      f.motion[i] = MOTION.lane;
      // The lane, and where along it the particle starts (spread evenly).
      f.slot[i] = lane + j / k;
      i++;
    }
  }
  placeLanes(f, 0);
  return f;
}

/** How long an operand takes to flow the length of its lane, in seconds. */
const LANE_PERIOD = 2.4;

/**
 * Moves the lane particles to where they are at time `seconds`: A operands flow right along their
 * row, B operands down along their column, and wrap round when they reach the array.
 */
export function placeLanes(f: Formation, seconds: number): void {
  for (let i = 0; i < f.count; i++) {
    if (f.motion[i] !== MOTION.lane) continue;
    const slot = f.slot[i] ?? 0;
    const lane = Math.floor(slot);
    const along = (slot - lane + seconds / LANE_PERIOD) % 1;
    const toward = 0.02 + along * (GRID_LEFT - 0.05);
    if (lane < ARRAY_SIZE) {
      f.x[i] = toward;
      f.y[i] = cellCenter(lane, 0).y;
    } else {
      f.x[i] = cellCenter(0, lane - ARRAY_SIZE).x;
      f.y[i] = toward;
    }
  }
}

/** Seconds for the compute wavefront to cross the array once, and the pause before the next. */
const WAVE_PERIOD = 3.2;
const WAVE_SPAN = 2 * ARRAY_SIZE + 2;

/**
 * How bright processing element (row, col) is at time `seconds`, 0 to 1. Operands enter the
 * array skewed, so element (row, col) starts its multiply-accumulates at step row + col: the
 * work sweeps across the array as a diagonal wavefront, which this traces.
 */
export function waveIntensity(row: number, col: number, seconds: number): number {
  const front = ((seconds / WAVE_PERIOD) % 1) * WAVE_SPAN - 1;
  const d = row + col - front;
  return Math.exp(-d * d * 0.9);
}

// ---------------------------------------------------------------------------------------------
// 2. Robots: an Apex track, with the car lapping it.

export interface Track {
  /** [x, y, color] in cm; color 0 blue, 1 yellow, 2 the big orange timing cones. */
  cones: readonly (readonly number[])[];
  /** The car's position over one lap, in cm, in order. */
  lap: readonly (readonly number[])[];
}

/** Maps track coordinates (cm, y up) into a unit square, keeping the shape. */
function fitTrack(track: Track): {
  map: (x: number, y: number) => { x: number; y: number };
  aspect: number;
} {
  const xs = track.cones.map((c) => c[0] ?? 0);
  const ys = track.cones.map((c) => c[1] ?? 0);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX;
  const h = maxY - minY;
  const aspect = w / h;
  // The longer side spans the unit square, less a margin for the cones' own size; the other is
  // centered.
  const scale = 0.98 / Math.max(w, h);
  const offX = (1 - w * scale) / 2;
  const offY = (1 - h * scale) / 2;
  return {
    map: (x, y) => ({ x: offX + (x - minX) * scale, y: offY + (maxY - y) * scale }),
    aspect,
  };
}

/** Cumulative arc length along a closed path, normalized so the full loop is 1. */
export function loopLengths(points: readonly { x: number; y: number }[]): number[] {
  const lengths = [0];
  let total = 0;
  for (let i = 1; i <= points.length; i++) {
    const a = points[i - 1];
    const b = points[i % points.length];
    if (a && b) total += Math.hypot(b.x - a.x, b.y - a.y);
    lengths.push(total);
  }
  return lengths.map((l) => l / total);
}

/** The point at fraction s (0 to 1, wrapping) of the way round a closed path. */
export function pointOnLoop(
  points: readonly { x: number; y: number }[],
  lengths: readonly number[],
  s: number,
): { x: number; y: number } {
  const u = ((s % 1) + 1) % 1;
  let lo = 0;
  let hi = points.length;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((lengths[mid] ?? 0) <= u) lo = mid;
    else hi = mid;
  }
  const a = points[lo] ?? { x: 0, y: 0 };
  const b = points[(lo + 1) % points.length] ?? a;
  const l0 = lengths[lo] ?? 0;
  const l1 = lengths[lo + 1] ?? 1;
  const t = l1 > l0 ? (u - l0) / (l1 - l0) : 0;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Particles in the car and its trail; the head is slot 0. */
export const CAR_PARTICLES = 18;
/** How far back the trail reaches, as a share of the lap. */
const TRAIL = 0.07;

export interface TrackFormation extends Formation {
  /** The lap in the unit square, and its normalized arc lengths, for placing the car. */
  lap: { x: number; y: number }[];
  lapLengths: number[];
}

/**
 * The track as particles: a small cluster per cone in its color, a faint dotted racing line
 * along the car's lap, and the car itself, a bright head with a fading trail.
 */
export function trackFormation(count: number, track: Track): TrackFormation {
  const { map, aspect } = fitTrack(track);
  const lap = track.lap.map((p) => map(p[0] ?? 0, p[1] ?? 0));
  const lapLengths = loopLengths(lap);
  const f: TrackFormation = { ...empty(count, aspect), lap, lapLengths };
  const car = Math.min(CAR_PARTICLES, Math.floor(count / 10));
  const [onCones = 0, onLine = 0] = apportion(count - car, [0.62, 0.38]);
  const perCone = apportion(
    onCones,
    track.cones.map((c) => (c[2] === 2 ? 2 : 1)),
  );
  const random = mulberry32(11);
  let i = 0;
  track.cones.forEach((cone, c) => {
    const center = map(cone[0] ?? 0, cone[1] ?? 0);
    const kind = cone[2] ?? 0;
    const k = perCone[c] ?? 0;
    for (let j = 0; j < k; j++) {
      const angle = (j / Math.max(1, k)) * Math.PI * 2 + random();
      const r = k > 1 ? 0.0045 : 0;
      f.x[i] = center.x + Math.cos(angle) * r;
      f.y[i] = center.y + Math.sin(angle) * r;
      f.color[i] = kind === 0 ? COLOR.blue : kind === 1 ? COLOR.gold : COLOR.accent;
      f.alpha[i] = 0.95;
      f.size[i] = kind === 2 ? 1.25 : 1;
      i++;
    }
  });
  for (let j = 0; j < onLine; j++) {
    const p = pointOnLoop(lap, lapLengths, j / onLine);
    f.x[i] = p.x;
    f.y[i] = p.y;
    f.color[i] = COLOR.faint;
    f.alpha[i] = 0.9;
    f.size[i] = 0.7;
    i++;
  }
  for (let j = 0; j < car; j++) {
    f.color[i] = COLOR.accent;
    f.alpha[i] = j === 0 ? 1 : 1 - j / car;
    f.size[i] = j === 0 ? 2.4 : 1.6 - j / car;
    f.motion[i] = MOTION.car;
    f.slot[i] = j / Math.max(1, car - 1);
    i++;
  }
  placeCar(f, 0);
  return f;
}

/** The lap is 24.5 s in the simulation; the intro plays it four times faster. */
export const LAP_SECONDS = 24.516 / 4;

/** Moves the car and its trail to where they are at time `seconds`. */
export function placeCar(f: TrackFormation, seconds: number): void {
  const head = seconds / LAP_SECONDS;
  for (let i = 0; i < f.count; i++) {
    if (f.motion[i] !== MOTION.car) continue;
    const p = pointOnLoop(f.lap, f.lapLengths, head - (f.slot[i] ?? 0) * TRAIL);
    f.x[i] = p.x;
    f.y[i] = p.y;
  }
}

// ---------------------------------------------------------------------------------------------
// 3. Models: minillm's causal attention triangle.

/**
 * Row t of the attention weights (query position t over key positions 0..t) as a triangle of
 * cells, each a small patch of particles whose brightness follows its weight. The mask leaves
 * the upper triangle empty.
 */
export function attentionFormation(
  count: number,
  weights: readonly (readonly number[])[],
): Formation {
  const n = weights.length;
  const f = empty(count, 1);
  const cells: { t: number; s: number; w: number }[] = [];
  weights.forEach((row, t) => row.forEach((w, s) => cells.push({ t, s, w })));
  const perCell = apportion(
    count,
    cells.map(() => 1),
  );
  const pitch = 1 / n;
  let i = 0;
  cells.forEach(({ t, s, w }, c) => {
    const k = perCell[c] ?? 0;
    const side = Math.ceil(Math.sqrt(k));
    for (let j = 0; j < k; j++) {
      // A small grid inside the cell, so a cell reads as a block of light.
      const gx = (j % side) + 0.5;
      const gy = Math.floor(j / side) + 0.5;
      f.x[i] = (s + 0.12 + (gx / side) * 0.76) * pitch;
      f.y[i] = (t + 0.12 + (gy / side) * 0.76) * pitch;
      f.color[i] = COLOR.accent;
      f.alpha[i] = attentionAlpha(w);
      f.size[i] = 0.85 + 0.5 * Math.sqrt(w);
      i++;
    }
  });
  return f;
}

/**
 * Brightness for a weight: a square root, so the small weights that carry the pattern (most rows
 * give the first token half or more) stay visible next to the large ones.
 */
export function attentionAlpha(w: number): number {
  return 0.08 + 0.92 * Math.sqrt(Math.max(0, Math.min(1, w)));
}

// ---------------------------------------------------------------------------------------------
// 4. Search: the hero's HNSW graph, as drawn in its SVG.

export interface Point {
  x: number;
  y: number;
}

/** The parts of the hero's drawing, in pixels on the stage, read from its SVG. */
export interface SearchScene {
  /** Graph nodes; `upper` for nodes drawn on a layer above 0, which are drawn larger. */
  nodes: { x: number; y: number; upper: boolean }[];
  /** Graph links, the layers' outlines and the search route, as line segments. */
  edges: [Point, Point][];
  outlines: [Point, Point][];
  route: [Point, Point][];
  /** The route's stops (the search's visited nodes on its path). */
  stops: Point[];
}

/** Spreads `k` points evenly over a set of segments, in proportion to their lengths. */
function alongSegments(segments: readonly [Point, Point][], k: number): Point[] {
  const lengths = segments.map(([a, b]) => Math.hypot(b.x - a.x, b.y - a.y));
  const total = lengths.reduce((s, l) => s + l, 0);
  const points: Point[] = [];
  if (total <= 0 || k <= 0) return points;
  const step = total / k;
  let segment = 0;
  let before = 0;
  for (let j = 0; j < k; j++) {
    const at = (j + 0.5) * step;
    while (segment < segments.length - 1 && before + (lengths[segment] ?? 0) < at) {
      before += lengths[segment] ?? 0;
      segment++;
    }
    const [a, b] = segments[segment] ?? [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ];
    const l = lengths[segment] ?? 1;
    const t = l > 0 ? Math.min(1, (at - before) / l) : 0;
    points.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return points;
}

/**
 * The graph as particles: one on each node (two on the upper layers' larger nodes), the route
 * in the accent color, and the rest spread along the links and the layers' outlines.
 */
export function searchFormation(count: number, scene: SearchScene): Formation {
  const f = empty(count, 1);
  let i = 0;
  const put = (p: Point, color: number, alpha: number, size: number) => {
    if (i >= count) return;
    f.x[i] = p.x;
    f.y[i] = p.y;
    f.color[i] = color;
    f.alpha[i] = alpha;
    f.size[i] = size;
    i++;
  };
  for (const node of scene.nodes) put(node, COLOR.dim, 0.95, node.upper ? 1.35 : 1.05);
  for (const stop of scene.stops) put(stop, COLOR.accent, 1, 1.6);
  const left = Math.max(0, count - i);
  const [onRoute = 0, onOutlines = 0, onEdges = 0] = apportion(left, [0.1, 0.2, 0.7]);
  for (const p of alongSegments(scene.route, onRoute)) put(p, COLOR.accent, 1, 1);
  for (const p of alongSegments(scene.outlines, onOutlines)) put(p, COLOR.faint, 1, 0.75);
  for (const p of alongSegments(scene.edges, onEdges)) put(p, COLOR.faint, 0.9, 0.7);
  // With very few particles, any left over sit on the first node.
  const fallback = scene.nodes[0] ?? { x: 0, y: 0 };
  while (i < count) put(fallback, COLOR.dim, 0, 0);
  return f;
}

/**
 * Reads the hero's drawing from the paths and shapes its SVG renders (HnswSearch.tsx draws each
 * layer's points as one path of circles and its links as one path of segments), in the SVG's own
 * coordinates; the engine maps them to the screen with the SVG's live transform.
 */
export function parseNodes(d: string): Point[] {
  const nodes: Point[] = [];
  const re = /M(-?[\d.]+) (-?[\d.]+)a([\d.]+)/g;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    nodes.push({ x: Number(m[1]) + Number(m[3]), y: Number(m[2]) });
  }
  return nodes;
}

export function parseSegments(d: string): [Point, Point][] {
  const segments: [Point, Point][] = [];
  const re = /M(-?[\d.]+)[ ,](-?[\d.]+)L(-?[\d.]+)[ ,](-?[\d.]+)/g;
  for (let m = re.exec(d); m; m = re.exec(d)) {
    segments.push([
      { x: Number(m[1]), y: Number(m[2]) },
      { x: Number(m[3]), y: Number(m[4]) },
    ]);
  }
  return segments;
}

/** A layer's outline (M x,y H x L x,y H x Z) as its four sides. */
export function parseOutline(d: string): [Point, Point][] {
  const n = d.match(/-?[\d.]+/g)?.map(Number) ?? [];
  const [x0 = 0, y0 = 0, x1 = 0, x2 = 0, y2 = 0, x3 = 0] = n;
  const a = { x: x0, y: y0 };
  const b = { x: x1, y: y0 };
  const c = { x: x2, y: y2 };
  const e = { x: x3, y: y2 };
  return [
    [a, b],
    [b, c],
    [c, e],
    [e, a],
  ];
}
