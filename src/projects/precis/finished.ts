import type { Totals } from "./sim/pipeline";

const n = (x: number) => x.toLocaleString("en-US");

/**
 * How a finished run ended, for the kill report: "All 2,000 papers finished" only when every
 * paper did; otherwise how many finished and what happened to the rest. With injected faults a
 * paper can fail for good, so a run may end with fewer papers done than it started with.
 */
export function papersFinished(totals: Totals, papers: number): string {
  if (totals.papersDone === papers) return `All ${n(papers)} papers finished`;
  const rest = [
    ...(totals.papersFailed > 0 ? [`${n(totals.papersFailed)} failed`] : []),
    ...(totals.papersLost > 0 ? [`${n(totals.papersLost)} unfinished`] : []),
  ];
  return [`${n(totals.papersDone)} of ${n(papers)} papers finished`, ...rest].join(", ");
}
