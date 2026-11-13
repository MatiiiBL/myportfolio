import { describe, expect, it } from "vitest";
import reference from "./reference-graph.json";
import { bruteForceKnn, buildHnsw, recallAtK, searchHnsw, type HnswGraph } from "./hnsw";
import { Mt19937_64 } from "./mt19937";
import { makePoints } from "./points";

// reference-graph.json is the graph vecdex itself builds for makePoints(300, pointSeed)
// (SOURCE.md says how): its levels and links read back from the index file, and the results of
// 360 searches.

const points = reference.points.map(([x, y]) => ({ x: x as number, y: y as number }));

describe("Mt19937_64", () => {
  it("matches std::mt19937_64 (the standard's 10000th output for the default seed)", () => {
    const rng = new Mt19937_64(5489n);
    let value = 0n;
    for (let i = 0; i < 10000; i++) value = rng.next();
    expect(value).toBe(9981545732273789042n);
  });
});

describe("the HNSW port", () => {
  const graph = buildHnsw(points, {
    M: reference.params.M,
    efConstruction: reference.params.efConstruction,
    seed: BigInt(reference.params.seed),
  });

  it("indexes the seeded points makePoints draws", () => {
    expect(makePoints(points.length, reference.pointSeed)).toEqual(points);
  });

  it("builds vecdex's graph link for link", () => {
    expect(graph.levels).toEqual(reference.levels);
    expect(graph.entryPoint).toBe(reference.entryPoint);
    expect(graph.maxLevel).toBe(reference.maxLevel);
    expect(graph.links).toEqual(reference.links);
  });

  it("returns vecdex's results for every reference search", () => {
    for (const s of reference.searches) {
      const [x, y] = s.query as [number, number];
      const found = searchHnsw(graph, { x, y }, s.k, s.ef).neighbors;
      expect(found.map((n) => n.id)).toEqual(s.ids);
      expect(found.map((n) => n.distance)).toEqual(s.distances);
    }
  });

  it("keeps the invariants HnswIndex::inspect() checks", () => {
    expectHealthy(graph);
  });

  it("finds exactly what brute force finds when ef covers the whole graph", () => {
    for (let i = 0; i < 50; i++) {
      const query = { x: (i * 197) % 1000, y: (i * 389) % 1000 };
      const exact = bruteForceKnn(points, query, 10);
      const found = searchHnsw(graph, query, 10, points.length).neighbors;
      expect(found).toEqual(exact);
      expect(recallAtK(found, exact, 10)).toBe(1);
    }
  });

  it("does less work than brute force at a small ef", () => {
    let recall = 0;
    let work = 0;
    const queries = 100;
    for (let i = 0; i < queries; i++) {
      const query = { x: (i * 211) % 1000, y: (i * 467) % 1000 };
      const result = searchHnsw(graph, query, 10, 10);
      recall += recallAtK(result.neighbors, bruteForceKnn(points, query, 10), 10);
      work += result.distanceCount;
    }
    expect(recall / queries).toBeGreaterThan(0.95);
    expect(work / queries).toBeLessThan(points.length / 3);
  });

  it("records a trace consistent with its result", () => {
    const query = { x: 512, y: 488 };
    const result = searchHnsw(graph, query, 10, 10);
    let counted = 1;
    const layers = new Set<number>();
    let finalResults: number[] = [];
    for (const step of result.steps) {
      if (step.kind === "greedy") layers.add(step.layer);
      if (step.kind !== "stop") counted += step.evaluated.length;
      if (step.kind === "expand") finalResults = step.results;
    }
    expect(layers).toEqual(new Set(Array.from({ length: graph.maxLevel }, (_, i) => i + 1)));
    expect(result.steps.at(-1)?.kind).toBe("stop");
    expect(result.distanceCount).toBe(counted);
    // With ef = k the last kept set is the answer.
    expect([...finalResults].sort((a, b) => a - b)).toEqual(
      result.neighbors.map((n) => n.id).sort((a, b) => a - b),
    );
  });
});

describe("recallAtK", () => {
  it("counts a result that ties the k-th true distance as a hit", () => {
    const truth = [
      { distance: 1, id: 0 },
      { distance: 4, id: 1 },
    ];
    const found = [
      { distance: 1, id: 0 },
      { distance: 4, id: 7 },
    ];
    expect(recallAtK(found, truth, 2)).toBe(1);
    expect(
      recallAtK(
        [
          { distance: 1, id: 0 },
          { distance: 5, id: 3 },
        ],
        truth,
        2,
      ),
    ).toBe(0.5);
  });
});

function expectHealthy(graph: HnswGraph) {
  const n = graph.points.length;
  graph.links.forEach((layers, node) => {
    expect(layers.length).toBe((graph.levels[node] ?? -1) + 1);
    layers.forEach((ids, layer) => {
      expect(ids.length).toBeLessThanOrEqual(layer === 0 ? 2 * graph.params.M : graph.params.M);
      expect(new Set(ids).size).toBe(ids.length);
      for (const id of ids) {
        expect(id).not.toBe(node);
        expect(id).toBeLessThan(n);
        expect(graph.levels[id]).toBeGreaterThanOrEqual(layer);
      }
    });
  });
  expect(graph.levels[graph.entryPoint]).toBe(graph.maxLevel);
  const seen = new Set([graph.entryPoint]);
  const frontier = [graph.entryPoint];
  for (let i = 0; i < frontier.length; i++) {
    for (const id of graph.links[frontier[i] as number]?.[0] ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        frontier.push(id);
      }
    }
  }
  expect(seen.size).toBe(n);
}
