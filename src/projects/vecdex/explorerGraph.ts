import { buildHnsw, type HnswGraph } from "./hnsw";
import { makePoints } from "./points";

// The explorer's index. vecdex defaults to M = 16 and efConstruction = 200, sized for
// 128-dimensional vectors; on 300 points in 2-D, M = 4 gives the graph five layers to descend
// instead of two, which is the part worth watching.
export const EXPLORER_GRAPH = {
  pointCount: 300,
  pointSeed: 7,
  M: 4,
  efConstruction: 100,
  seed: 42n,
  k: 10,
} as const;

let cached: HnswGraph | undefined;

/** The explorer's graph, built on first use (a few milliseconds). */
export function explorerGraph(): HnswGraph {
  cached ??= buildHnsw(makePoints(EXPLORER_GRAPH.pointCount, EXPLORER_GRAPH.pointSeed), {
    M: EXPLORER_GRAPH.M,
    efConstruction: EXPLORER_GRAPH.efConstruction,
    seed: EXPLORER_GRAPH.seed,
  });
  return cached;
}
