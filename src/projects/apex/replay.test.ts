import { describe, expect, it } from "vitest";
import {
  lapAt,
  loadReplay,
  mappedCount,
  pathAt,
  poseAt,
  sampleIndex,
  speedBand,
  speedTrace,
  stateAt,
} from "./replay";

const replay = loadReplay();

describe("the recorded run", () => {
  it("agrees with the run's own result", () => {
    const { summary, laps } = replay;
    expect(laps).toHaveLength(10);
    const total = laps.reduce((sum, lap) => sum + lap.time, 0);
    expect(total).toBeCloseTo(summary.totalTime, 1);
    expect(laps[0]?.time).toBeCloseTo(summary.lap1, 1);
    expect(Math.min(...laps.slice(1).map((l) => l.time))).toBeCloseTo(summary.bestLap, 1);
    for (const lap of laps) expect(Math.abs(lap.end - lap.start - lap.time)).toBeLessThan(0.02);
    expect(summary.conesHit).toBe(0);
  });

  it("maps every cone once, with its color, during lap 1", () => {
    const { landmarks, cones, summary } = replay;
    expect(landmarks).toHaveLength(summary.cones);
    expect(mappedCount(replay, 0)).toBe(0);
    const lap1End = replay.laps[0]?.end ?? 0;
    expect(mappedCount(replay, lap1End)).toBe(cones.length);
    for (const lm of landmarks) {
      const nearest = cones.reduce(
        (best, c) => Math.min(best, Math.hypot(c.x - lm.x, c.y - lm.y)),
        Infinity,
      );
      const sameColor = cones.some(
        (c) => c.color === lm.color && Math.hypot(c.x - lm.x, c.y - lm.y) === nearest,
      );
      // The run's map error is a few centimeters RMS; nothing is near another cone instead.
      expect(nearest).toBeLessThan(0.2);
      expect(sameColor).toBe(true);
    }
    let previous = 0;
    for (let t = 0; t <= replay.duration; t += 0.5) {
      const count = mappedCount(replay, t);
      expect(count).toBeGreaterThanOrEqual(previous);
      previous = count;
    }
  });

  it("interpolates the pose between samples", () => {
    const i = 1000;
    const at = poseAt(replay, i * replay.dt);
    expect(at.x).toBeCloseTo(replay.x[i] ?? NaN, 9);
    const mid = poseAt(replay, (i + 0.5) * replay.dt);
    expect(mid.x).toBeCloseTo(((replay.x[i] ?? 0) + (replay.x[i + 1] ?? 0)) / 2, 9);
    expect(sampleIndex(replay, replay.duration + 5)).toBe(replay.x.length - 1);
  });

  it("knows the mission state, the lap and the path at any time", () => {
    expect(stateAt(replay, 0)).toBe("staged");
    expect(stateAt(replay, 10)).toBe("exploring");
    expect(stateAt(replay, 100)).toBe("racing");
    expect(stateAt(replay, replay.duration)).toBe("stopping");
    const lap4 = replay.laps[3];
    expect(lapAt(replay, (lap4?.start ?? 0) + 1)?.lap).toBe(4);
    expect(lapAt(replay, 0)).toBeNull();
    expect(pathAt(replay, 10)?.length).toBeGreaterThan(1);
    expect(pathAt(replay, 100)).toBeNull();
    expect(pathAt(replay, replay.duration)?.length).toBeGreaterThan(1);
  });

  it("splits a lap into speed runs that cover every sample without gaps", () => {
    const lap = replay.laps[5];
    if (!lap) throw new Error("no lap 6");
    const runs = speedTrace(replay, lap.start, lap.end);
    const samples = sampleIndex(replay, lap.end) - sampleIndex(replay, lap.start) + 1;
    const points = runs.reduce((sum, r) => sum + r.points.length, 0);
    expect(points).toBe(samples + runs.length - 1);
    for (let i = 1; i < runs.length; i++) {
      expect(runs[i]?.points[0]).toEqual(runs[i - 1]?.points.at(-1));
      expect(runs[i]?.band).not.toBe(runs[i - 1]?.band);
    }
    expect(speedBand(5)).toBe(0);
    expect(speedBand(28.6)).toBe(5);
  });
});
