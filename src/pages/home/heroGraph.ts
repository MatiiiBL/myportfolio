import {
  bruteForceKnn,
  buildHnsw,
  searchHnsw,
  type HnswGraph,
  type Point,
  type SearchResult,
} from "../../lib/hnsw/hnsw";
import { GRID, makePoints } from "../../lib/hnsw/points";

// The home page's HNSW index: the graph vecdex's own code builds (src/lib/hnsw is a verified
// port of it) for 96 seeded points. vecdex defaults to M = 16 for 128-dimensional vectors; on
// 96 points in 2-D, M = 4 gives a graph sparse enough to read. The level seed is one that gives
// three layers, the number the drawing has room for.
export const HERO_GRAPH = {
  pointCount: 96,
  pointSeed: 3,
  M: 4,
  efConstruction: 100,
  seed: 29n,
  /** Candidates kept on layer 0; the hero asks for the single nearest point. */
  ef: 6,
} as const;

let cached: HnswGraph | undefined;

/** The hero's graph, built on first use (a few milliseconds, the same on server and client). */
export function heroGraph(): HnswGraph {
  cached ??= buildHnsw(makePoints(HERO_GRAPH.pointCount, HERO_GRAPH.pointSeed), {
    M: HERO_GRAPH.M,
    efConstruction: HERO_GRAPH.efConstruction,
    seed: HERO_GRAPH.seed,
  });
  return cached;
}

/** What a search did on one layer of the graph, for drawing. */
export interface LayerRoute {
  layer: number;
  /** The nodes the search walked through, from where it entered the layer to where it left. */
  path: number[];
  /** Every node whose distance to the query was computed on this layer. */
  visited: number[];
}

export interface HeroSearch {
  /** One route per layer, top layer first. */
  layers: LayerRoute[];
  /** The point the search returned. */
  result: number;
  /** Calls to the distance function, counting the entry point. */
  distances: number;
  /** Whether a full scan finds no closer point (a tie counts as the same answer). */
  exact: boolean;
}

/**
 * Where the query starts, in the unit square the drawing projects from: a spot whose search hops
 * on every layer (1, 2 and 4 hops, top to bottom), so the first frame shows the whole descent.
 */
export const HERO_START: Point = { x: 0.2, y: 0.65 };

/**
 * Searches the hero's graph for the point nearest to q, given in the drawing's unit square. The
 * graph's points sit on an integer grid, so q is rounded to it (distances stay exact integers).
 */
export function heroSearch(q: Point): HeroSearch {
  const graph = heroGraph();
  const query = { x: Math.round(q.x * GRID), y: Math.round(q.y * GRID) };
  const search = searchHnsw(graph, query, 1, HERO_GRAPH.ef);
  const found = search.neighbors[0];
  const truth = bruteForceKnn(graph.points, query, 1)[0];
  return {
    layers: routeOf(graph, search),
    result: found?.id ?? graph.entryPoint,
    distances: search.distanceCount,
    exact: found !== undefined && truth !== undefined && found.distance === truth.distance,
  };
}

/** A point of the graph in the unit square the drawing projects from. */
export function unitPoint(graph: HnswGraph, node: number): Point {
  const p = graph.points[node] ?? { x: 0, y: 0 };
  return { x: p.x / GRID, y: p.y / GRID };
}

/**
 * Turns a recorded search (searchHnsw's steps) into one route per layer, top layer first. On the
 * upper layers the route is the greedy walk. On layer 0 the search keeps a beam of candidates, so
 * its route is the chain of links by which it first reached the node it returned.
 */
export function routeOf(graph: HnswGraph, search: SearchResult): LayerRoute[] {
  const routes = new Map<number, LayerRoute>();
  for (let layer = graph.maxLevel; layer >= 0; layer--) {
    routes.set(layer, { layer, path: [], visited: [] });
  }
  const at = (layer: number): LayerRoute => {
    const route = routes.get(layer);
    if (!route) throw new Error(`The graph has no layer ${layer}`);
    return route;
  };

  const parent = new Map<number, number>();
  for (const step of search.steps) {
    if (step.kind === "greedy") {
      const route = at(step.layer);
      if (route.path.length === 0) route.path.push(step.from);
      if (step.to !== route.path[route.path.length - 1]) route.path.push(step.to);
      route.visited.push(...step.evaluated);
    } else if (step.kind === "expand") {
      at(0).visited.push(...step.evaluated);
      for (const id of step.accepted) if (!parent.has(id)) parent.set(id, step.node);
    }
  }

  // Each layer starts where the one above ended; a layer the walk crossed without a step (its
  // entry had no links there) is just that node.
  let entry = graph.entryPoint;
  for (let layer = graph.maxLevel; layer > 0; layer--) {
    const route = at(layer);
    if (route.path.length === 0) route.path.push(entry);
    entry = route.path[route.path.length - 1] ?? entry;
  }

  const found = search.neighbors[0]?.id ?? entry;
  const chain = [found];
  for (let node = found; node !== entry;) {
    const from = parent.get(node);
    if (from === undefined) break;
    chain.unshift(from);
    node = from;
  }
  at(0).path = chain[0] === entry ? chain : [entry, ...chain];
  return [...routes.values()];
}
