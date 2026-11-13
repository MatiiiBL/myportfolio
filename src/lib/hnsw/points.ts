// Seeded 2-D point sets for the HNSW graphs: a mixture of clusters and background noise on a
// 1000 × 1000 integer grid. Clustered data is where HNSW's neighbor heuristic earns its keep, so
// the toy set has clusters too. Only operations every JavaScript engine rounds identically are
// used (integer arithmetic, + - * /, Math.sqrt and detmath's log), so the prerender and every
// browser place the same points, and the reference graph in hnsw.test.ts stays valid.

import { log } from "../detmath";

export const GRID = 1000;

interface Cluster {
  x: number;
  y: number;
  spread: number;
  share: number;
}

const CLUSTERS: readonly Cluster[] = [
  { x: 230, y: 260, spread: 70, share: 0.17 },
  { x: 700, y: 210, spread: 95, share: 0.17 },
  { x: 520, y: 560, spread: 55, share: 0.12 },
  { x: 180, y: 720, spread: 85, share: 0.15 },
  { x: 800, y: 740, spread: 75, share: 0.15 },
  { x: 470, y: 860, spread: 45, share: 0.08 },
];

/** mulberry32: a small, fast 32-bit generator of floats in [0, 1); plenty for toy points. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A standard normal draw by Marsaglia's polar method, which needs no sine or cosine. */
function gaussian(random: () => number): number {
  for (;;) {
    const u = 2 * random() - 1;
    const v = 2 * random() - 1;
    const s = u * u + v * v;
    if (s > 0 && s < 1) return u * Math.sqrt((-2 * log(s)) / s);
  }
}

/** `count` distinct integer points in [16, GRID - 16], the same for the same seed. */
export function makePoints(count: number, seed: number): { x: number; y: number }[] {
  const random = mulberry32(seed);
  const clamp = (v: number) => Math.min(GRID - 16, Math.max(16, Math.round(v)));
  const seen = new Set<number>();
  const points: { x: number; y: number }[] = [];
  while (points.length < count) {
    let pick = random();
    let x = 16 + random() * (GRID - 32);
    let y = 16 + random() * (GRID - 32);
    for (const c of CLUSTERS) {
      if (pick < c.share) {
        x = c.x + gaussian(random) * c.spread;
        y = c.y + gaussian(random) * c.spread;
        break;
      }
      pick -= c.share;
    }
    const p = { x: clamp(x), y: clamp(y) };
    const key = p.y * GRID + p.x;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push(p);
  }
  return points;
}
