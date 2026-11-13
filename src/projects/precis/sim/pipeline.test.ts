import { describe, expect, it } from "vitest";
import bench from "../data/bench-throughput.json";
import {
  BENCH_FAULTS,
  BENCH_LIMITS,
  NO_FAULTS,
  planPapers,
  simulate,
  type Scenario,
} from "./pipeline";

const throughput = (papers: number, seconds: number) => (papers * 60) / seconds;

describe("the workload", () => {
  it("has the benchmark's requests per paper", () => {
    const plans = planPapers(2000, 1);
    const requests = plans.reduce(
      (n, p) => n + p.stages.reduce((m, s) => m + s.requests.length, 0),
      0,
    );
    expect(requests / 2000).toBeGreaterThan(4.9);
    expect(requests / 2000).toBeLessThan(5.15);
  });
});

describe("the throughput benchmark (results/bench-throughput.json)", () => {
  const scenario = (ceiling: number): Scenario => ({
    papers: bench.papers,
    ceiling,
    limits: BENCH_LIMITS,
    overloadAbove: null,
    faults: NO_FAULTS,
    seed: 1,
  });

  for (const point of bench.points) {
    it(`runs at the measured rate with a ceiling of ${point.concurrency}`, () => {
      const run = simulate(scenario(point.concurrency));
      const rate = throughput(run.totals.papersDone, run.duration);
      expect(run.totals.papersDone).toBe(bench.papers);
      expect(rate / point.papers_per_minute).toBeGreaterThan(0.9);
      expect(rate / point.papers_per_minute).toBeLessThan(1.1);
      // Admission control holds the server's limits: no 429 at any ceiling.
      expect(run.totals.rateLimited).toBe(0);
      expect(Math.max(...run.samples.map((s) => s.limit))).toBeLessThanOrEqual(point.concurrency);
    });
  }

  it("is bound by the input-token limit from a ceiling of 128", () => {
    for (const ceiling of [128, 256]) {
      const run = simulate(scenario(ceiling));
      const itpm = (run.totals.inputTokens * 60) / run.duration / BENCH_LIMITS.itpm;
      expect(itpm).toBeGreaterThan(0.9);
      expect(itpm).toBeLessThanOrEqual(1);
    }
    const run = simulate(scenario(64));
    expect((run.totals.inputTokens * 60) / run.duration / BENCH_LIMITS.itpm).toBeLessThan(0.8);
  });

  it("is deterministic for a seed", () => {
    expect(simulate(scenario(64)).totals).toEqual(simulate(scenario(64)).totals);
  });
});

describe("AIMD against an overloaded server (tests/runtime/test_convergence.py)", () => {
  const run = simulate({
    papers: 600,
    ceiling: 64,
    limits: null,
    overloadAbove: 24,
    faults: NO_FAULTS,
    seed: 2,
  });

  it("finds the capacity in a few round trips, overshooting by one doubling at most", () => {
    const firstOverload = run.samples.findIndex(
      (s, i) => i > 0 && s.limit < (run.samples[i - 1]?.limit ?? 0),
    );
    expect(firstOverload).toBeGreaterThan(0);
    expect(firstOverload).toBeLessThan(30);
    expect(Math.max(...run.samples.map((s) => s.limit))).toBeLessThanOrEqual(2 * 24);
  });

  it("settles into a sawtooth around the capacity with few 529s", () => {
    const late = run.samples.filter((s) => s.t >= 120 && s.t < run.duration - 60);
    const mean = late.reduce((m, s) => m + s.limit, 0) / late.length;
    expect(mean).toBeGreaterThan(12);
    expect(mean).toBeLessThan(26);
    expect(Math.max(...late.map((s) => s.limit))).toBeLessThanOrEqual(28);
    expect(run.totals.overloaded / (run.totals.paid + run.totals.overloaded)).toBeLessThan(0.05);
    expect(run.totals.papersFailed).toBe(0);
  });
});

describe("SIGKILL and resume (results/bench-faults.json settings)", () => {
  const base: Scenario = {
    papers: 500,
    ceiling: 32,
    limits: BENCH_LIMITS,
    overloadAbove: null,
    faults: BENCH_FAULTS,
    seed: 3,
  };
  const uninterrupted = simulate(base);
  const at = uninterrupted.samples.find((s) => s.done >= 200)?.t ?? 0;
  const run = simulate({ ...base, killAt: at });

  it("finishes every paper and pays for no request twice", () => {
    const kill = run.kill;
    expect(kill).not.toBeNull();
    expect(run.totals.papersLost).toBe(0);
    expect(run.totals.papersDone + run.totals.papersFailed).toBe(500);
    expect(run.totals.papersDone).toBeGreaterThanOrEqual(498);
    expect(run.totals.paidTwice).toBe(0);
    expect(kill?.finishedAtKill).toBeGreaterThanOrEqual(200);
  });

  it("sends again only the requests that were in flight, and replays finished turns", () => {
    const kill = run.kill;
    expect(kill?.resent).toBe(kill?.inFlight);
    expect(kill?.replayed ?? 0).toBeGreaterThan(0);
    expect(run.totals.retries).toBeGreaterThan(0);
  });

  it("files one paid answer for every request of every finished paper, and never two", () => {
    const final = new Map<number, number>();
    for (const tr of run.transitions) final.set(tr.paper, tr.state);
    const plans = planPapers(base.papers, base.seed);
    let checked = 0;
    plans.forEach((plan, paper) => {
      if (final.get(paper) !== 4) return;
      for (const stage of plan.stages) {
        for (const req of stage.requests) {
          expect(run.paidByRequest.get(req.hash), req.hash).toBe(1);
          checked += 1;
        }
      }
    });
    expect(checked).toBeGreaterThan(2000);
    expect([...run.paidByRequest.values()].every((count) => count === 1)).toBe(true);
    expect(run.totals.paid).toBe(run.paidByRequest.size);
  });
});
