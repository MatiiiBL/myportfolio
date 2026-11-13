import type { SearchResult } from "../../lib/hnsw/hnsw";

/** What the explorer draws after a given number of search steps. */
export interface Frame {
  /** The layer the search is on; its links are the ones drawn. */
  layer: number;
  /** Nodes the greedy descent stood on, in order, ending where layer 0 starts. */
  path: number[];
  /** The node whose links this step scanned, if any. */
  current: number | null;
  /** The neighbors this step computed a distance to, and which of them were kept. */
  scanned: number[];
  accepted: number[];
  /** Every layer-0 node whose distance has been computed so far. */
  evaluated: Set<number>;
  /** Layer-0 nodes already expanded. */
  expanded: Set<number>;
  /** The best ef so far (layer 0), and the squared radius they span once ef are held. */
  results: number[];
  bound: number | null;
  /** Distance computations up to and including this step. */
  distanceCount: number;
  done: boolean;
  /** A one-line, plain-language account of this step. */
  description: string;
}

/**
 * The frame after steps[0..index]. Index -1 is the moment before the first step, at the entry
 * point on the top layer.
 */
export function frameAt(
  result: SearchResult,
  index: number,
  entryPoint: number,
  topLayer: number,
  ef: number,
): Frame {
  const frame: Frame = {
    layer: topLayer,
    path: [entryPoint],
    current: null,
    scanned: [],
    accepted: [],
    evaluated: new Set(),
    expanded: new Set(),
    results: [],
    bound: null,
    distanceCount: 1,
    done: false,
    description: `Start at the entry point, node ${entryPoint}, on the top layer.`,
  };
  const last = Math.min(index, result.steps.length - 1);
  for (let i = 0; i <= last; i++) {
    const step = result.steps[i];
    if (step === undefined) break;
    frame.scanned = [];
    frame.accepted = [];
    frame.current = null;
    if (step.kind === "greedy") {
      frame.layer = step.layer;
      frame.current = step.from;
      frame.scanned = step.evaluated;
      frame.distanceCount += step.evaluated.length;
      if (step.evaluated.length === 0) {
        frame.description =
          `Layer ${step.layer}: node ${step.from} is the only node here, so the search drops ` +
          `to layer ${step.layer - 1}.`;
      } else if (step.to !== step.from) {
        frame.path.push(step.to);
        frame.description =
          `Layer ${step.layer}: checked ${plural(step.evaluated.length, "neighbor")} of node ` +
          `${step.from} and moved to node ${step.to}, the closest to the query.`;
      } else {
        frame.description =
          `Layer ${step.layer}: no neighbor of node ${step.from} is closer to the query, so ` +
          `the search drops to layer ${step.layer - 1} from here.`;
      }
    } else if (step.kind === "expand") {
      // Layer 0 starts from where the descent ended, already measured.
      if (frame.expanded.size === 0) frame.evaluated.add(step.node);
      frame.layer = 0;
      frame.current = step.node;
      frame.scanned = step.evaluated;
      frame.accepted = step.accepted;
      frame.expanded.add(step.node);
      for (const id of step.evaluated) frame.evaluated.add(id);
      frame.results = step.results;
      frame.bound = step.bound;
      frame.distanceCount += step.evaluated.length;
      frame.description =
        `Layer 0: expanded node ${step.node}, measured ` +
        `${plural(step.evaluated.length, "new neighbor")} and kept ${step.accepted.length}. ` +
        `The list now holds ${plural(step.results.length, "node")} (at most ef = ${ef}).`;
    } else {
      frame.layer = 0;
      frame.done = true;
      frame.description =
        step.candidate === null
          ? "Layer 0: no candidates left to expand. The search is done."
          : `Layer 0: the closest unexpanded candidate, node ${step.candidate}, is farther than ` +
            `every kept result, so nothing it leads to can improve them. The search is done.`;
    }
  }
  return frame;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}
