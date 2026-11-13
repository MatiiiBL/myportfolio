import { describe, expect, it } from "vitest";
import apexTrack from "./data/apex-track.json";
import attention from "./data/attention.json";
import {
  ARRAY_SIZE,
  CAR_PARTICLES,
  COLOR,
  LAP_SECONDS,
  MOTION,
  apportion,
  attentionAlpha,
  attentionFormation,
  loopLengths,
  parseNodes,
  parseOutline,
  parseSegments,
  placeCar,
  placeLanes,
  pointOnLoop,
  searchFormation,
  siliconFormation,
  trackFormation,
  waveIntensity,
  type Formation,
  type SearchScene,
} from "./formations";

const track = { cones: apexTrack.cones, lap: apexTrack.lap8 };

function inUnitSquare(f: Formation): boolean {
  for (let i = 0; i < f.count; i++) {
    const x = f.x[i] ?? -1;
    const y = f.y[i] ?? -1;
    if (x < 0 || x > 1 || y < 0 || y > 1) return false;
  }
  return true;
}

describe("apportion", () => {
  it("shares a total exactly, in proportion", () => {
    expect(apportion(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(apportion(1200, [0.68, 0.32])).toEqual([816, 384]);
    expect(apportion(7, [0, 1])).toEqual([0, 7]);
    for (const n of [0, 1, 99, 500, 1200]) {
      expect(apportion(n, [3, 1, 4, 1, 5]).reduce((a, b) => a + b, 0)).toBe(n);
    }
  });
});

describe("the silicon formation", () => {
  for (const count of [500, 1200]) {
    it(`draws all 64 processing elements and 16 operand lanes with ${count} particles`, () => {
      const f = siliconFormation(count);
      expect(f.count).toBe(count);
      expect(inUnitSquare(f)).toBe(true);
      const cells = new Set<number>();
      const lanes = new Set<number>();
      for (let i = 0; i < count; i++) {
        if (f.motion[i] === MOTION.cell) cells.add(f.slot[i] ?? -1);
        if (f.motion[i] === MOTION.lane) lanes.add(Math.floor(f.slot[i] ?? -1));
      }
      expect(cells.size).toBe(ARRAY_SIZE * ARRAY_SIZE);
      expect(lanes.size).toBe(2 * ARRAY_SIZE);
      expect(siliconFormation(count)).toEqual(f);
    });
  }

  it("lights the array along a diagonal wavefront, row + col", () => {
    for (let t = 0; t < 3.2; t += 0.1) {
      for (let r = 0; r < ARRAY_SIZE; r++) {
        for (let c = 0; c < ARRAY_SIZE; c++) {
          // Cells on the same anti-diagonal are always equally bright.
          expect(waveIntensity(r, c, t)).toBeCloseTo(waveIntensity(c, r, t));
          if (r + 1 < ARRAY_SIZE && c > 0) {
            expect(waveIntensity(r + 1, c - 1, t)).toBeCloseTo(waveIntensity(r, c, t));
          }
        }
      }
    }
    const peaks = Array.from({ length: 15 }, (_, d) =>
      Math.max(
        ...Array.from({ length: 64 }, (_, s) =>
          waveIntensity(Math.min(d, 7), d - Math.min(d, 7), s * 0.05),
        ),
      ),
    );
    for (const peak of peaks) expect(peak).toBeGreaterThan(0.9);
  });

  it("keeps operands in their lanes as they flow", () => {
    const f = siliconFormation(500);
    placeLanes(f, 1.3);
    expect(inUnitSquare(f)).toBe(true);
  });
});

describe("the track formation", () => {
  it("puts every cone in its color and the car on the lap", () => {
    const f = trackFormation(1200, track);
    expect(f.count).toBe(1200);
    expect(inUnitSquare(f)).toBe(true);
    const colors = new Map<number, number>();
    let car = 0;
    for (let i = 0; i < f.count; i++) {
      colors.set(f.color[i] ?? -1, (colors.get(f.color[i] ?? -1) ?? 0) + 1);
      if (f.motion[i] === MOTION.car) car++;
    }
    expect(car).toBe(CAR_PARTICLES);
    // Blue and yellow cones in the track's proportion (89 blue, 93 yellow), give or take the
    // one particle a cone may gain or lose to rounding.
    const blue = colors.get(COLOR.blue) ?? 0;
    const yellow = colors.get(COLOR.gold) ?? 0;
    const perCone = (blue + yellow) / (89 + 93);
    expect(Math.abs(blue - 89 * perCone)).toBeLessThanOrEqual(89);
    expect(Math.abs(yellow - 93 * perCone)).toBeLessThanOrEqual(93);
    expect(Math.abs(blue / yellow - 89 / 93)).toBeLessThan(0.1);
  });

  it("drives the car round the lap and back to the start after one lap time", () => {
    const f = trackFormation(500, track);
    const head = () => {
      const i = Array.from(f.motion).findIndex((m) => m === MOTION.car);
      return { x: f.x[i] ?? 0, y: f.y[i] ?? 0 };
    };
    placeCar(f, 0);
    const start = head();
    placeCar(f, LAP_SECONDS / 2);
    const half = head();
    placeCar(f, LAP_SECONDS);
    const lap = head();
    expect(Math.hypot(half.x - start.x, half.y - start.y)).toBeGreaterThan(0.1);
    expect(lap.x).toBeCloseTo(start.x, 5);
    expect(lap.y).toBeCloseTo(start.y, 5);
  });

  it("measures a closed loop and walks it", () => {
    const square = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ];
    const lengths = loopLengths(square);
    expect(lengths).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(pointOnLoop(square, lengths, 0.125)).toEqual({ x: 0.5, y: 0 });
    expect(pointOnLoop(square, lengths, 1.625)).toEqual({ x: 0.5, y: 1 });
    expect(pointOnLoop(square, lengths, -0.125)).toEqual({ x: 0, y: 0.5 });
  });
});

describe("the attention formation", () => {
  it("draws the causal triangle, brighter where the weight is larger", () => {
    const n = attention.weights.length;
    const f = attentionFormation(1200, attention.weights);
    expect(f.count).toBe(1200);
    expect(inUnitSquare(f)).toBe(true);
    for (let i = 0; i < f.count; i++) {
      const s = Math.floor((f.x[i] ?? 0) * n);
      const t = Math.floor((f.y[i] ?? 0) * n);
      // Only keys at or before the query: the mask leaves the upper triangle empty.
      expect(s).toBeLessThanOrEqual(t);
      expect(f.alpha[i]).toBeCloseTo(attentionAlpha(attention.weights[t]?.[s] ?? 0), 5);
    }
    expect(attentionAlpha(0.9)).toBeGreaterThan(attentionAlpha(0.3));
    expect(attentionAlpha(0)).toBeGreaterThan(0);
    expect(attentionAlpha(1)).toBe(1);
  });
});

describe("the search formation", () => {
  // The formats HnswSearch.tsx draws in.
  const nodes = "M10 20a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0 -4.4 0M30.5 40a2.2 2.2 0 1 0 4.4 0";
  const edges = "M10 20L30 40M30 40L50 20";
  const plane = "M92,14H444L360,106H8Z";

  it("reads nodes, links and layer outlines from the SVG's paths", () => {
    expect(parseNodes(nodes)).toEqual([
      { x: 12.2, y: 20 },
      { x: 32.7, y: 40 },
    ]);
    expect(parseSegments(edges)).toEqual([
      [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ],
      [
        { x: 30, y: 40 },
        { x: 50, y: 20 },
      ],
    ]);
    expect(parseOutline(plane).map(([a]) => a)).toEqual([
      { x: 92, y: 14 },
      { x: 444, y: 14 },
      { x: 360, y: 106 },
      { x: 8, y: 106 },
    ]);
  });

  it("puts every particle on a node, a link, an outline or the route", () => {
    const scene: SearchScene = {
      nodes: parseNodes(nodes).map((p) => ({ ...p, upper: false })),
      edges: parseSegments(edges),
      outlines: parseOutline(plane),
      route: [
        [
          { x: 12.2, y: 20 },
          { x: 32.7, y: 40 },
        ],
      ],
      stops: [{ x: 32.7, y: 40 }],
    };
    const f = searchFormation(300, scene);
    expect(f.count).toBe(300);
    const segments = [...scene.edges, ...scene.outlines, ...scene.route];
    const onSegment = (x: number, y: number) =>
      segments.some(([a, b]) => {
        const len = Math.hypot(b.x - a.x, b.y - a.y);
        const cross = Math.abs((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)) / len;
        return cross < 1e-3;
      });
    const onPoint = (x: number, y: number) =>
      [...scene.nodes, ...scene.stops].some((p) => Math.hypot(p.x - x, p.y - y) < 1e-6);
    for (let i = 0; i < f.count; i++) {
      expect(onSegment(f.x[i] ?? 0, f.y[i] ?? 0) || onPoint(f.x[i] ?? 0, f.y[i] ?? 0)).toBe(true);
    }
    expect(searchFormation(300, scene)).toEqual(f);
  });
});
