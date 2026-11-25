import { describe, expect, it } from "vitest";
import { papersFinished } from "./finished";
import { BENCH_FAULTS, BENCH_LIMITS, NO_FAULTS, simulate, type Scenario } from "./sim/pipeline";

// The page's "Rate limits" preset at its default ceiling and its "Injected faults" preset
// (PipelineSim.tsx), each killed at 10:00 simulated.
const limits: Scenario = {
  papers: 2000,
  ceiling: 128,
  limits: BENCH_LIMITS,
  overloadAbove: null,
  faults: NO_FAULTS,
  seed: 1,
  killAt: 600,
};
const faults: Scenario = {
  papers: 500,
  ceiling: 32,
  limits: BENCH_LIMITS,
  overloadAbove: null,
  faults: BENCH_FAULTS,
  seed: 3,
  killAt: 600,
};

describe("the kill report's last line", () => {
  it('says "All" when every paper finished', () => {
    const run = simulate(limits);
    expect(run.totals.papersDone).toBe(2000);
    expect(papersFinished(run.totals, limits.papers)).toBe("All 2,000 papers finished");
  });

  it("counts the failed papers instead when some failed for good", () => {
    const run = simulate(faults);
    expect(run.totals).toMatchObject({ papersDone: 498, papersFailed: 2, papersLost: 0 });
    expect(papersFinished(run.totals, faults.papers)).toBe("498 of 500 papers finished, 2 failed");
  });

  it("names papers left unfinished", () => {
    const totals = { ...simulate(faults).totals, papersDone: 497, papersLost: 1 };
    expect(papersFinished(totals, 500)).toBe("497 of 500 papers finished, 2 failed, 1 unfinished");
  });
});
