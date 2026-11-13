import { describe, expect, it } from "vitest";
import { bruteForceKnn, l2Squared, searchHnsw } from "../../lib/hnsw/hnsw";
import { GRID } from "../../lib/hnsw/points";
import { HERO_GRAPH, heroGraph, heroSearch, routeOf } from "./heroGraph";

const graph = heroGraph();
const N = 25;
const grid = Array.from({ length: N * N }, (_, k) => ({
  x: Math.round(((k % N) / (N - 1)) * GRID),
  y: Math.round((Math.floor(k / N) / (N - 1)) * GRID),
}));

describe("the home page's HNSW graph", () => {
  it("has three layers, nested, entered from the top one", () => {
    expect(graph.points).toHaveLength(HERO_GRAPH.pointCount);
    expect(graph.maxLevel).toBe(2);
    expect(graph.levels[graph.entryPoint]).toBe(2);
    expect([0, 1, 2].map((l) => graph.levels.filter((v) => v >= l).length)).toEqual([96, 21, 4]);
  });

  it("draws each search as a route along the graph's links, descending layer by layer", () => {
    for (const q of grid) {
      const search = searchHnsw(graph, q, 1, HERO_GRAPH.ef);
      const layers = routeOf(graph, search);
      expect(layers.map((l) => l.layer)).toEqual([2, 1, 0]);
      expect(layers[0]?.path[0]).toBe(graph.entryPoint);
      layers.forEach((route, k) => {
        route.path.slice(1).forEach((node, i) => {
          const from = route.path[i] ?? -1;
          expect(graph.links[from]?.[route.layer]).toContain(node);
        });
        const below = layers[k + 1];
        if (below) expect(below.path[0]).toBe(route.path[route.path.length - 1]);
      });
      expect(layers[2]?.path.at(-1)).toBe(search.neighbors[0]?.id);
    }
  });

  it("says whether a full scan would find a closer point, and it almost never does", () => {
    let same = 0;
    for (const q of grid) {
      const hero = heroSearch({ x: q.x / GRID, y: q.y / GRID });
      const truth = bruteForceKnn(graph.points, q, 1)[0];
      const found = graph.points[hero.result];
      if (!truth || !found) throw new Error("no answer");
      expect(hero.exact).toBe(l2Squared(found, q) === truth.distance);
      expect(hero.distances).toBeLessThan(graph.points.length);
      if (hero.exact) same++;
    }
    expect(same / grid.length).toBeGreaterThan(0.95);
  });
});
