// The 2-D point set the HNSW explorer indexes: a seeded mixture of clusters and background
// noise on a 1000 × 1000 integer grid. Clustered data is where HNSW's neighbor heuristic earns
// its keep, so the toy set has clusters too. The same seed gives the same points everywhere,
// which the reference graph in hnsw.test.ts depends on.

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

/** mulberry32: a small, fast 32-bit generator; plenty for placing toy points. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` distinct integer points in [16, GRID - 16], the same for the same seed. */
export function makePoints(count: number, seed: number): { x: number; y: number }[] {
  const random = mulberry32(seed);
  const gaussian = () => {
    const u = 1 - random();
    const v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const clamp = (v: number) => Math.min(GRID - 16, Math.max(16, Math.round(v)));
  const seen = new Set<number>();
  const points: { x: number; y: number }[] = [];
  while (points.length < count) {
    let pick = random();
    let x = 16 + random() * (GRID - 32);
    let y = 16 + random() * (GRID - 32);
    for (const c of CLUSTERS) {
      if (pick < c.share) {
        x = c.x + gaussian() * c.spread;
        y = c.y + gaussian() * c.spread;
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
