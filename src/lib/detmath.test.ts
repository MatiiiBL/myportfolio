import { describe, expect, it } from "vitest";
import { exp, log } from "./detmath";

const relative = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("deterministic exp and log", () => {
  it("computes e^x close to Math.exp", () => {
    // The reduction's error grows with k = round(x / ln 2): 1e-13 at the ends of the range.
    for (let x = -700; x <= 700; x += 0.731) {
      expect(relative(exp(x), Math.exp(x)), `exp(${x})`).toBeLessThan(1e-13);
    }
    for (let x = -6; x <= 6; x += 0.0137) {
      expect(relative(exp(x), Math.exp(x)), `exp(${x})`).toBeLessThan(1e-14);
    }
  });

  it("computes ln x to within a few ulps of Math.log", () => {
    for (let x = 1e-300; x < 1e300; x *= 1.37) {
      expect(Math.abs(log(x) - Math.log(x)), `log(${x})`).toBeLessThan(
        1e-14 * Math.max(1, Math.abs(Math.log(x))),
      );
    }
    for (let x = 0.001; x < 4; x += 0.0071) {
      expect(Math.abs(log(x) - Math.log(x)), `log(${x})`).toBeLessThan(1e-15);
    }
  });

  it("handles the edges as Math does", () => {
    expect(exp(0)).toBe(1);
    expect(log(1)).toBe(0);
    expect(exp(1000)).toBe(Number.POSITIVE_INFINITY);
    expect(exp(-1000)).toBe(0);
    expect(log(0)).toBe(Number.NEGATIVE_INFINITY);
    expect(log(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
    expect(log(-1)).toBeNaN();
    expect(exp(Number.NaN)).toBeNaN();
  });

  it("inverts: log(exp(x)) returns x", () => {
    for (let x = -50; x <= 50; x += 0.37) {
      expect(Math.abs(log(exp(x)) - x)).toBeLessThan(1e-13 * Math.max(1, Math.abs(x)));
    }
  });

  it("returns the same bits as the copy the Précis simulation was calibrated with", () => {
    // Values recorded from the earlier implementation, so moving it changed no run.
    expect(exp(-0.06125)).toBe(0.940588063364342);
    expect(exp(0.35)).toBe(1.4190675485932573);
    expect(exp(-2.4)).toBe(0.0907179532894125);
  });
});
