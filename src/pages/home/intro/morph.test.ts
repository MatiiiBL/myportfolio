import { describe, expect, it } from "vitest";
import {
  HANDOVER,
  HOLDS,
  STAGES,
  bump,
  easeInOutCubic,
  flightPoint,
  handoverAt,
  phaseAt,
  stageAt,
  stagger,
  type Flight,
} from "./morph";

const steps = Array.from({ length: 1001 }, (_, i) => i / 1000);

describe("the intro's timeline", () => {
  it("holds each formation, then flies to the next, in order", () => {
    HOLDS.forEach(([start, end], k) => {
      for (const p of [start, (start + end) / 2, end])
        expect(phaseAt(p)).toEqual({ from: k, to: k, t: 0 });
    });
    for (let k = 1; k < HOLDS.length; k++) {
      const leave = HOLDS[k - 1]?.[1] ?? 0;
      const arrive = HOLDS[k]?.[0] ?? 0;
      const mid = phaseAt((leave + arrive) / 2);
      expect([mid.from, mid.to]).toEqual([k - 1, k]);
      expect(mid.t).toBeCloseTo(0.5, 12);
    }
  });

  it("moves the flight forward as the page scrolls down, and never jumps", () => {
    let previous = phaseAt(0);
    for (const p of steps) {
      const now = phaseAt(p);
      const before = previous.from + previous.t;
      const after = now.from + now.t;
      expect(after).toBeGreaterThanOrEqual(before - 1e-12);
      expect(after - before).toBeLessThan(0.07);
      previous = now;
    }
  });

  it("names the stages in order and hands over to the SVG only at the end", () => {
    const seen = steps.map(stageAt).filter((s, i, all) => s !== all[i - 1]);
    expect(seen).toEqual([...STAGES]);
    expect(handoverAt(HANDOVER[0] - 0.01)).toBe(0);
    expect(handoverAt(1)).toBe(1);
    for (let i = 1; i < steps.length; i++) {
      expect(handoverAt(steps[i] ?? 0)).toBeGreaterThanOrEqual(handoverAt(steps[i - 1] ?? 0));
    }
  });
});

describe("a particle's flight", () => {
  const flight: Flight = {
    ax: 10,
    ay: 20,
    bx: 210,
    by: 120,
    arc: 0.3,
    swirl: 0.8,
    cx: 100,
    cy: 100,
  };
  const at = (e: number) => {
    const out = { x: 0, y: 0 };
    flightPoint(flight, e, out);
    return out;
  };

  it("starts exactly at one formation and ends exactly at the next", () => {
    expect(at(0)).toEqual({ x: 10, y: 20 });
    expect(at(1)).toEqual({ x: 210, y: 120 });
  });

  it("bows and swirls away from the straight line in between", () => {
    const mid = at(0.5);
    const straight = { x: 110, y: 70 };
    expect(Math.hypot(mid.x - straight.x, mid.y - straight.y)).toBeGreaterThan(20);
  });

  it("depends only on its progress, so scrolling back retraces it exactly", () => {
    const down = steps.map((e) => at(e));
    const up = [...steps]
      .reverse()
      .map((e) => at(e))
      .reverse();
    expect(up).toEqual(down);
  });

  it("eases and staggers within the flight's bounds", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    for (const t of [0.1, 0.3, 0.7])
      expect(easeInOutCubic(1 - t)).toBeCloseTo(1 - easeInOutCubic(t));
    for (const delay of [0, 0.4, 1]) {
      expect(stagger(0, delay, 0.45)).toBe(0);
      expect(stagger(1, delay, 0.45)).toBe(1);
    }
    expect(stagger(0.3, 1, 0.45)).toBe(0);
    expect(bump(0)).toBe(0);
    expect(bump(1)).toBe(0);
    expect(bump(0.5)).toBe(1);
  });
});
