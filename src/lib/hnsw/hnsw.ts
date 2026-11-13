// A line-for-line port of vecdex's HNSW build and search (src/hnsw.cpp at the commit named in
// SOURCE.md), for 2-D points, so a page can show the graph vecdex would build and walk.
// hnsw.test.ts checks it link for link against the graph the C++ code builds for the same points.
//
// Coordinates are integers, so every squared distance is an integer below 2^24: exact in float32
// whatever the summation order, and therefore identical here and in vecdex's NEON kernel. Levels
// are drawn with detmath's log, so the prerender and every browser build the same graph.

import { log } from "../detmath";
import { Mt19937_64 } from "./mt19937";

export interface Point {
  x: number;
  y: number;
}

/** A node and its squared distance to some base point, as vecdex::Neighbor. */
export interface Neighbor {
  distance: number;
  id: number;
}

/** vecdex's ranking: smaller distance first, ties broken by smaller id. */
export function closer(a: Neighbor, b: Neighbor): boolean {
  return a.distance < b.distance || (a.distance === b.distance && a.id < b.id);
}

export function l2Squared(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export interface HnswParams {
  /** Links each new node makes per layer; layer 0 holds up to 2M. */
  M: number;
  efConstruction: number;
  seed: bigint;
}

export interface HnswGraph {
  readonly points: readonly Point[];
  readonly params: HnswParams;
  /** The highest layer of each node. */
  readonly levels: readonly number[];
  /** links[node][layer]: the node's neighbors on that layer, in stored order. */
  readonly links: readonly (readonly (readonly number[])[])[];
  readonly entryPoint: number;
  readonly maxLevel: number;
}

/** A binary heap whose top is the element for which `before` holds against every other. */
class Heap<T> {
  private readonly items: T[] = [];

  constructor(private readonly before: (a: T, b: T) => boolean) {}

  get size(): number {
    return this.items.length;
  }

  peek(): T | undefined {
    return this.items[0];
  }

  values(): readonly T[] {
    return this.items;
  }

  push(item: T): void {
    const items = this.items;
    items.push(item);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent] as T;
      if (!this.before(item, p)) break;
      items[i] = p;
      i = parent;
    }
    items[i] = item;
  }

  pop(): T | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (items.length === 0 || last === undefined) return top;
    let i = 0;
    for (;;) {
      const left = 2 * i + 1;
      if (left >= items.length) break;
      const right = left + 1;
      let child = left;
      if (right < items.length && this.before(items[right] as T, items[left] as T)) child = right;
      const c = items[child] as T;
      if (!this.before(c, last)) break;
      items[i] = c;
      i = child;
    }
    items[i] = last;
    return top;
  }
}

/** One step of a search, recorded for the visualization. */
export type SearchStep =
  | {
      kind: "greedy";
      layer: number;
      /** The node whose links were scanned, and where the walk stands afterwards. */
      from: number;
      to: number;
      evaluated: number[];
    }
  | {
      kind: "expand";
      node: number;
      /** Unvisited neighbors whose distance was computed, and which of them were kept. */
      evaluated: number[];
      accepted: number[];
      /** The best ef so far and the unexpanded candidates, after this step. */
      results: number[];
      candidates: number[];
      /** The squared distance of the worst kept result, once ef results are held. */
      bound: number | null;
    }
  | {
      kind: "stop";
      /** The candidate that was farther than every kept result, if that is why it stopped. */
      candidate: number | null;
    };

export interface SearchResult {
  /** The k nearest found, closest first. */
  neighbors: Neighbor[];
  steps: SearchStep[];
  /** Calls to the distance function, the unit of work an index is built to save. */
  distanceCount: number;
}

interface Recorder {
  steps: SearchStep[];
  distanceCount: number;
}

function maxLinks(params: HnswParams, layer: number): number {
  return layer === 0 ? 2 * params.M : params.M;
}

/** The graph under construction, and the build and search routines of src/hnsw.cpp. */
class Builder {
  readonly levels: number[] = [];
  readonly links: number[][][] = [];
  entryPoint = 0;
  maxLevel = 0;
  private readonly rng: Mt19937_64;
  private readonly levelMultiplier: number;

  constructor(
    readonly points: readonly Point[],
    readonly params: HnswParams,
  ) {
    this.rng = new Mt19937_64(params.seed);
    this.levelMultiplier = 1 / log(params.M);
  }

  private point(id: number): Point {
    return this.points[id] as Point;
  }

  private linksOf(node: number, layer: number): number[] {
    return (this.links[node] as number[][])[layer] as number[];
  }

  /** level = floor(-ln(U) * mL), U from the generator's top 53 bits, as vecdex draws it. */
  private randomLevel(): number {
    const u = 1 - Number(this.rng.next() >> 11n) * 2 ** -53;
    return Math.max(0, Math.trunc(-log(u) * this.levelMultiplier));
  }

  store(): void {
    const level = this.randomLevel();
    this.levels.push(level);
    this.links.push(Array.from({ length: level + 1 }, () => []));
  }

  greedyClosest(query: Point, entry: Neighbor, layer: number, rec?: Recorder): Neighbor {
    for (let moved = true; moved;) {
      moved = false;
      const current = entry.id;
      const evaluated: number[] = [];
      for (const id of this.linksOf(current, layer)) {
        const d = l2Squared(query, this.point(id));
        evaluated.push(id);
        if (d < entry.distance) {
          entry = { distance: d, id };
          moved = true;
        }
      }
      if (rec) {
        rec.distanceCount += evaluated.length;
        rec.steps.push({ kind: "greedy", layer, from: current, to: entry.id, evaluated });
      }
    }
    return entry;
  }

  /** Best-first search on one layer; returns the best ef found, closest first. */
  searchLayer(
    query: Point,
    entry: Neighbor,
    ef: number,
    layer: number,
    rec?: Recorder,
  ): Neighbor[] {
    const visited = new Set<number>([entry.id]);
    const candidates = new Heap<Neighbor>(closer);
    const results = new Heap<Neighbor>((a, b) => closer(b, a));
    candidates.push(entry);
    results.push(entry);

    for (;;) {
      const current = candidates.pop();
      if (current === undefined) {
        rec?.steps.push({ kind: "stop", candidate: null });
        break;
      }
      const worst = results.peek();
      if (results.size >= ef && worst !== undefined && closer(worst, current)) {
        rec?.steps.push({ kind: "stop", candidate: current.id });
        break;
      }
      const fresh = this.linksOf(current.id, layer).filter((id) => {
        if (visited.has(id)) return false;
        visited.add(id);
        return true;
      });
      const accepted: number[] = [];
      for (const id of fresh) {
        const next = { distance: l2Squared(query, this.point(id)), id };
        const front = results.peek();
        if (results.size < ef || (front !== undefined && closer(next, front))) {
          candidates.push(next);
          results.push(next);
          accepted.push(id);
          if (results.size > ef) results.pop();
        }
      }
      if (rec) {
        rec.distanceCount += fresh.length;
        const full = results.size >= ef;
        rec.steps.push({
          kind: "expand",
          node: current.id,
          evaluated: fresh,
          accepted,
          results: results.values().map((n) => n.id),
          candidates: candidates.values().map((n) => n.id),
          bound: full ? (results.peek()?.distance ?? null) : null,
        });
      }
    }
    return [...results.values()].sort((a, b) => (closer(a, b) ? -1 : closer(b, a) ? 1 : 0));
  }

  /** The paper's heuristic (Algorithm 4) as vecdex implements it; `candidates` is consumed. */
  selectNeighbors(candidates: Neighbor[], m: number): Neighbor[] {
    candidates.sort((a, b) => (closer(a, b) ? -1 : closer(b, a) ? 1 : 0));
    if (candidates.length <= m) return candidates;
    const kept: Neighbor[] = [];
    for (const candidate of candidates) {
      if (kept.length === m) break;
      const v = this.point(candidate.id);
      const diverse = kept.every(
        (other) => !(l2Squared(v, this.point(other.id)) < candidate.distance),
      );
      if (diverse) kept.push(candidate);
    }
    return kept;
  }

  insert(node: number): void {
    const level = this.levels[node] ?? 0;
    if (node === 0) {
      this.entryPoint = node;
      this.maxLevel = level;
      return;
    }
    const query = this.point(node);
    const maxLevel = this.maxLevel;
    let entry: Neighbor = {
      distance: l2Squared(query, this.point(this.entryPoint)),
      id: this.entryPoint,
    };
    for (let layer = maxLevel; layer > level; layer--) {
      entry = this.greedyClosest(query, entry, layer);
    }
    const ef = Math.max(this.params.efConstruction, this.params.M);
    const top = Math.min(level, maxLevel);
    const chosen: Neighbor[][] = [];
    for (let layer = top; layer >= 0; layer--) {
      const results = this.searchLayer(query, entry, ef, layer);
      entry = results[0] as Neighbor;
      chosen[layer] = this.selectNeighbors(results, this.params.M);
    }
    const own = this.links[node] as number[][];
    for (let layer = 0; layer <= top; layer++) {
      own[layer] = (chosen[layer] as Neighbor[]).map((n) => n.id);
    }
    for (let layer = 0; layer <= top; layer++) {
      this.linkBack(node, layer, chosen[layer] as Neighbor[]);
    }
    if (level > maxLevel) {
      this.maxLevel = level;
      this.entryPoint = node;
    }
  }

  /** Links each neighbor back to `node`; a full list re-selects from its links plus `node`. */
  private linkBack(node: number, layer: number, neighbors: readonly Neighbor[]): void {
    const limit = maxLinks(this.params, layer);
    for (const neighbor of neighbors) {
      const block = this.linksOf(neighbor.id, layer);
      if (block.length < limit) {
        block.push(node);
        continue;
      }
      const base = this.point(neighbor.id);
      const candidates = block.map((id) => ({ distance: l2Squared(base, this.point(id)), id }));
      candidates.push({ distance: neighbor.distance, id: node });
      const nodeLinks = this.links[neighbor.id] as number[][];
      nodeLinks[layer] = this.selectNeighbors(candidates, limit).map((n) => n.id);
    }
  }
}

/** Builds the graph serially, one point at a time in order, as HnswIndex::add does on one thread. */
export function buildHnsw(points: readonly Point[], params: HnswParams): HnswGraph {
  const builder = new Builder(points, params);
  for (let node = 0; node < points.length; node++) {
    builder.store();
    builder.insert(node);
  }
  return {
    points,
    params,
    levels: builder.levels,
    links: builder.links,
    entryPoint: builder.entryPoint,
    maxLevel: builder.maxLevel,
  };
}

/** HnswIndex::search, recording every step: greedy descent, then best-first search on layer 0. */
export function searchHnsw(graph: HnswGraph, query: Point, k: number, ef: number): SearchResult {
  const builder = new Builder(graph.points, graph.params);
  builder.levels.push(...graph.levels);
  builder.links.push(...graph.links.map((layers) => layers.map((ids) => [...ids])));
  builder.entryPoint = graph.entryPoint;
  builder.maxLevel = graph.maxLevel;

  const rec: Recorder = { steps: [], distanceCount: 0 };
  if (graph.points.length === 0) return { neighbors: [], ...rec };
  const ep = graph.entryPoint;
  let entry: Neighbor = { distance: l2Squared(query, graph.points[ep] as Point), id: ep };
  rec.distanceCount = 1;
  for (let layer = graph.maxLevel; layer > 0; layer--) {
    entry = builder.greedyClosest(query, entry, layer, rec);
  }
  const found = builder.searchLayer(query, entry, Math.max(ef, k), 0, rec);
  return { neighbors: found.slice(0, k), ...rec };
}

/** The exact k nearest neighbors, closest first: the reference every recall is measured against. */
export function bruteForceKnn(points: readonly Point[], query: Point, k: number): Neighbor[] {
  return points
    .map((p, id) => ({ distance: l2Squared(query, p), id }))
    .sort((a, b) => (closer(a, b) ? -1 : closer(b, a) ? 1 : 0))
    .slice(0, k);
}

/**
 * Distance-threshold recall@k, vecdex's threshold_recall_at_k: the share of the first k results
 * no farther than the k-th true neighbor. A result that ties with a true neighbor counts as a hit.
 */
export function recallAtK(
  found: readonly Neighbor[],
  truth: readonly Neighbor[],
  k: number,
): number {
  const kth = truth[Math.min(k, truth.length) - 1];
  if (kth === undefined) return 0;
  const threshold = kth.distance + 1e-5 * Math.max(Math.abs(kth.distance), 1);
  return found.slice(0, k).filter((n) => n.distance <= threshold).length / k;
}
