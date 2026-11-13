// A small HNSW (hierarchical navigable small world) index, the structure behind vecdex, built
// and searched the way the paper describes (Malkov & Yashunin, 2018): each point gets a random
// top layer, is inserted by a greedy descent from the entry point, and is linked to its M
// nearest neighbors on every layer it lives on. A search walks greedily toward the query on
// each upper layer, drops a layer when it cannot get closer, and finishes with a beam search on
// layer 0.
//
// It only uses +, -, * and comparisons on doubles (no Math.log or Math.sqrt), which are
// correctly rounded in every JavaScript engine, so the prerendered page and the browser build
// exactly the same graph.

export interface Point {
  x: number;
  y: number;
}

export interface Graph {
  points: Point[];
  /** Highest layer each point belongs to. */
  levels: number[];
  /** links[layer][point]: the point's neighbors on that layer (empty above its level). */
  links: number[][][];
  /** Where every search starts: a point on the top layer. */
  entry: number;
  /** Index of the top layer. */
  top: number;
}

export interface BuildOptions {
  n: number;
  seed: number;
  /** Links per point on the upper layers; layer 0 allows twice as many. */
  m: number;
  /** Beam width while inserting. */
  efConstruction: number;
  /** The top layer index; a point's level is capped here. */
  maxLevel: number;
}

/** Mulberry32: a tiny seeded generator, so the graph is the same on every render. */
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

/** Squared Euclidean distance: it orders points the same way as the distance itself. */
export function dist2(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

/** Points spread over the unit square with a minimum spacing, so the drawing stays legible. */
function samplePoints(n: number, rng: () => number): Point[] {
  const points: Point[] = [];
  const min2 = (0.62 * 0.62) / n;
  let attempts = 0;
  while (points.length < n && attempts < n * 400) {
    attempts++;
    const p = { x: 0.04 + 0.92 * rng(), y: 0.06 + 0.88 * rng() };
    if (points.every((q) => dist2(p, q) >= min2)) points.push(p);
  }
  return points;
}

/** A search's view of one layer: who it compared and how it got there. */
interface LayerSearch {
  /** Nearest first. */
  found: number[];
  /** Every point whose distance to the query was computed, in order. */
  visited: number[];
  /** The point from which each visited point was first reached. */
  parent: Map<number, number>;
}

/** Beam search on one layer (the paper's SEARCH-LAYER) with a candidate list of size ef. */
function searchLayer(
  graph: Pick<Graph, "points" | "links">,
  q: Point,
  entries: number[],
  ef: number,
  layer: number,
): LayerSearch {
  const { points, links } = graph;
  const d = (i: number) => dist2(points[i] ?? q, q);
  const visited = [...entries];
  const seen = new Set(entries);
  const parent = new Map<number, number>();
  const candidates = [...entries];
  const results = [...entries].sort((a, b) => d(a) - d(b));
  while (candidates.length > 0) {
    candidates.sort((a, b) => d(a) - d(b));
    const c = candidates.shift();
    const furthest = results[results.length - 1];
    if (c === undefined || furthest === undefined || d(c) > d(furthest)) break;
    for (const e of links[layer]?.[c] ?? []) {
      if (seen.has(e)) continue;
      seen.add(e);
      visited.push(e);
      parent.set(e, c);
      const worst = results[results.length - 1];
      if (results.length < ef || worst === undefined || d(e) < d(worst)) {
        candidates.push(e);
        results.push(e);
        results.sort((a, b) => d(a) - d(b));
        if (results.length > ef) results.pop();
      }
    }
  }
  return { found: results, visited, parent };
}

/** Builds the index by inserting the points one at a time. */
export function buildGraph({ n, seed, m, efConstruction, maxLevel }: BuildOptions): Graph {
  const rng = mulberry32(seed);
  const points = samplePoints(n, rng);
  // A geometric level distribution with ratio 1/m, the paper's mL = 1/ln(m), drawn without
  // logarithms: keep climbing while a uniform draw lands below 1/m.
  const levels = points.map(() => {
    let level = 0;
    while (level < maxLevel && rng() < 1 / m) level++;
    return level;
  });
  const links: number[][][] = Array.from({ length: maxLevel + 1 }, () => points.map(() => []));
  const maxLinks = (layer: number) => (layer === 0 ? 2 * m : m);
  const graph = { points, links };
  let entry = 0;
  let top = levels[0] ?? 0;

  for (let i = 1; i < points.length; i++) {
    const q = points[i];
    const level = levels[i] ?? 0;
    if (!q) continue;
    let entries = [entry];
    for (let layer = top; layer > level; layer--) {
      entries = searchLayer(graph, q, entries, 1, layer).found.slice(0, 1);
    }
    for (let layer = Math.min(top, level); layer >= 0; layer--) {
      const { found } = searchLayer(graph, q, entries, efConstruction, layer);
      const neighbors = found.slice(0, m);
      const own = links[layer]?.[i];
      if (!own) continue;
      for (const e of neighbors) {
        own.push(e);
        const theirs = links[layer]?.[e];
        if (!theirs) continue;
        theirs.push(i);
        if (theirs.length > maxLinks(layer)) {
          const pe = points[e] ?? q;
          theirs.sort((a, b) => dist2(points[a] ?? pe, pe) - dist2(points[b] ?? pe, pe));
          theirs.length = maxLinks(layer);
        }
      }
      entries = found;
    }
    if (level > top) {
      top = level;
      entry = i;
    }
  }
  return { points, levels, links, entry, top };
}

export interface SearchTrace {
  /** One entry per layer, top layer first. */
  layers: {
    layer: number;
    /** The route from the layer's entry point to where the search left it. */
    path: number[];
    /** Every point whose distance was computed on this layer. */
    visited: number[];
  }[];
  /** The nearest point the search returned. */
  result: number;
  /** Distance computations, counting a point once per layer it was compared on. */
  distances: number;
  /** The true nearest point, by exhaustive scan. */
  exact: number;
}

/** Searches for the point nearest to q, recording the route on every layer. */
export function search(graph: Graph, q: Point, ef: number): SearchTrace {
  const layers: SearchTrace["layers"] = [];
  let entries = [graph.entry];
  let distances = 0;
  for (let layer = graph.top; layer >= 0; layer--) {
    const s = searchLayer(graph, q, entries, layer === 0 ? ef : 1, layer);
    const best = s.found[0] ?? graph.entry;
    const path = [best];
    for (let p = s.parent.get(best); p !== undefined; p = s.parent.get(p)) path.unshift(p);
    layers.push({ layer, path, visited: s.visited });
    distances += s.visited.length;
    entries = s.found.slice(0, 1);
  }
  return {
    layers,
    result: entries[0] ?? graph.entry,
    distances,
    exact: nearestByScan(graph.points, q),
  };
}

/** The exhaustive answer: compare the query with every point. */
export function nearestByScan(points: Point[], q: Point): number {
  let best = 0;
  points.forEach((p, i) => {
    if (dist2(p, q) < dist2(points[best] ?? p, q)) best = i;
  });
  return best;
}

/** The index drawn on the home page: 96 points, three layers. */
export const HOME_GRAPH_OPTIONS: BuildOptions = {
  n: 96,
  seed: 4,
  m: 4,
  efConstruction: 16,
  maxLevel: 2,
};

/** Beam width of the layer-0 search on the home page. */
export const HOME_EF = 6;
