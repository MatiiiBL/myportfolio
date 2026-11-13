import { describe, expect, it } from "vitest";
import replay from "../../../projects/apex/data/replay.json";
import reference from "../../../projects/minillm/data/attention-reference.json";
import apexTrack from "./data/apex-track.json";
import attention from "./data/attention.json";

// The intro carries small extracts so the home page does not load the project pages' data;
// these tests keep them equal to their sources (data/SOURCE.md).

describe("the intro's data", () => {
  it("has the Apex run's cones, and the car's lap 8 sampled every 0.2 s", () => {
    expect(apexTrack.cones).toEqual(replay.cones);
    const lap = replay.laps.find((l) => l.lap === apexTrack.lap);
    if (!lap) throw new Error("no such lap");
    expect(apexTrack.lapTime).toBe(lap.time);
    expect(apexTrack.startIndex).toBe(Math.ceil(lap.start / replay.dt));
    expect(apexTrack.endIndex).toBe(Math.floor(lap.end / replay.dt));
    const expected = [];
    for (let i = apexTrack.startIndex; i <= apexTrack.endIndex; i += apexTrack.stride) {
      expected.push([replay.x[i], replay.y[i]]);
    }
    expect(apexTrack.lap8).toEqual(expected);
  });

  it("has minillm's layer-15, head-0 attention weights, rounded to 4 decimals", () => {
    const source = reference[String(attention.layer) as keyof typeof reference][attention.head];
    expect(source).toBeDefined();
    expect(attention.weights).toEqual(
      source?.map((row) => row.map((w) => Math.round(w * 1e4) / 1e4)),
    );
    attention.weights.forEach((row, t) => {
      expect(row).toHaveLength(t + 1);
      expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 3);
    });
  });
});
