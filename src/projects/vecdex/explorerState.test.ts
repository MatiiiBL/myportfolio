import { describe, expect, it } from "vitest";
import reference from "../../lib/hnsw/reference-graph.json";
import { EXPLORER_GRAPH, explorerGraph } from "./explorerGraph";
import { frameAt } from "./explorerState";
import { searchHnsw } from "../../lib/hnsw/hnsw";

describe("the explorer's graph", () => {
  it("is the graph checked against vecdex's C++ build", () => {
    const graph = explorerGraph();
    expect(EXPLORER_GRAPH.pointSeed).toBe(reference.pointSeed);
    expect(graph.points.map((p) => [p.x, p.y])).toEqual(reference.points);
    expect(graph.links).toEqual(reference.links);
  });
});

describe("frameAt", () => {
  const graph = explorerGraph();
  const query = { x: 400, y: 450 };
  const ef = 16;
  const result = searchHnsw(graph, query, 10, ef);
  const frame = (i: number) => frameAt(result, i, graph.entryPoint, graph.maxLevel, ef);

  it("starts at the entry point on the top layer", () => {
    const start = frame(-1);
    expect(start.layer).toBe(graph.maxLevel);
    expect(start.path).toEqual([graph.entryPoint]);
    expect(start.distanceCount).toBe(1);
    expect(start.done).toBe(false);
  });

  it("ends on layer 0 with the search's own totals", () => {
    const end = frame(result.steps.length - 1);
    expect(end.done).toBe(true);
    expect(end.layer).toBe(0);
    expect(end.distanceCount).toBe(result.distanceCount);
    for (const n of result.neighbors) expect(end.evaluated.has(n.id)).toBe(true);
  });

  it("never lets the descent go back up, or the work go down", () => {
    let previous = frame(-1);
    for (let i = 0; i < result.steps.length; i++) {
      const next = frame(i);
      expect(next.layer).toBeLessThanOrEqual(previous.layer);
      expect(next.distanceCount).toBeGreaterThanOrEqual(previous.distanceCount);
      expect(next.path.slice(0, previous.path.length)).toEqual(previous.path);
      previous = next;
    }
  });

  it("clamps an index past the end to the final frame", () => {
    expect(frame(Number.POSITIVE_INFINITY)).toEqual(frame(result.steps.length - 1));
  });
});
