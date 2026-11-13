import { describe, expect, it } from "vitest";
import {
  buildGraph,
  HOME_EF,
  HOME_GRAPH_OPTIONS,
  mulberry32,
  nearestByScan,
  search,
  type Graph,
} from "./hnsw";

const graph = buildGraph(HOME_GRAPH_OPTIONS);

/** Points reachable from `from` on one layer, following links. */
function reachable(g: Graph, layer: number, from: number): Set<number> {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length > 0) {
    const i = queue.pop() ?? from;
    for (const j of g.links[layer]?.[i] ?? []) {
      if (!seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen;
}

const grid = Array.from({ length: 31 * 31 }, (_, k) => ({
  x: (k % 31) / 30,
  y: Math.floor(k / 31) / 30,
}));

describe("the home page's HNSW index", () => {
  it("is the same on every build", () => {
    expect(buildGraph(HOME_GRAPH_OPTIONS)).toEqual(graph);
    const a = mulberry32(1);
    const b = mulberry32(1);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("has every point and three nested layers, with the entry point on top", () => {
    expect(graph.points).toHaveLength(HOME_GRAPH_OPTIONS.n);
    expect(graph.top).toBe(2);
    expect(graph.levels[graph.entry]).toBe(2);
    const onLayer = (l: number) => graph.levels.filter((level) => level >= l).length;
    expect(onLayer(1)).toBeGreaterThanOrEqual(12);
    expect(onLayer(2)).toBeGreaterThanOrEqual(3);
    graph.links.forEach((layer, l) =>
      layer.forEach((neighbors, i) => {
        if ((graph.levels[i] ?? 0) < l) expect(neighbors).toEqual([]);
        for (const j of neighbors) expect(graph.levels[j]).toBeGreaterThanOrEqual(l);
      }),
    );
  });

  it("keeps the link limits: m per point above layer 0, 2m on it", () => {
    const { m } = HOME_GRAPH_OPTIONS;
    graph.links.forEach((layer, l) =>
      layer.forEach((neighbors) => {
        expect(neighbors.length).toBeLessThanOrEqual(l === 0 ? 2 * m : m);
        expect(new Set(neighbors).size).toBe(neighbors.length);
      }),
    );
  });

  it("can reach every point from the entry point on layer 0", () => {
    expect(reachable(graph, 0, graph.entry).size).toBe(graph.points.length);
  });

  it("finds the same nearest point as an exhaustive scan for every query on a grid", () => {
    for (const q of grid) {
      const trace = search(graph, q, HOME_EF);
      expect(trace.result).toBe(nearestByScan(graph.points, q));
      expect(trace.exact).toBe(trace.result);
    }
  });

  it("computes far fewer distances than the exhaustive scan", () => {
    const mean =
      grid.reduce((sum, q) => sum + search(graph, q, HOME_EF).distances, 0) / grid.length;
    expect(mean).toBeLessThan(graph.points.length / 2);
  });

  it("records a connected route that descends from the entry point", () => {
    const trace = search(graph, { x: 0.3, y: 0.7 }, HOME_EF);
    expect(trace.layers.map((l) => l.layer)).toEqual([2, 1, 0]);
    expect(trace.layers[0]?.path[0]).toBe(graph.entry);
    trace.layers.forEach((l, k) => {
      l.path.slice(1).forEach((p, i) => {
        expect(graph.links[l.layer]?.[l.path[i] ?? -1]).toContain(p);
      });
      const next = trace.layers[k + 1];
      if (next) expect(next.path[0]).toBe(l.path[l.path.length - 1]);
    });
    expect(trace.layers[2]?.path.at(-1)).toBe(trace.result);
  });
});
