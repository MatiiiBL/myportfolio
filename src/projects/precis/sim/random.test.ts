import { describe, expect, it } from "vitest";
import { Random } from "./random";

describe("the engine-independent generator", () => {
  it("draws normals with mean 0 and variance 1", () => {
    const rng = new Random(9);
    const n = 200_000;
    let sum = 0;
    let squares = 0;
    for (let i = 0; i < n; i++) {
      const z = rng.normal();
      sum += z;
      squares += z * z;
    }
    expect(Math.abs(sum / n)).toBeLessThan(0.01);
    expect(Math.abs(squares / n - 1)).toBeLessThan(0.01);
  });

  it("draws log-normals with mean 1 when mu = -sigma^2 / 2, as the latency model does", () => {
    const rng = new Random(4);
    const n = 200_000;
    let sum = 0;
    for (let i = 0; i < n; i++) sum += rng.lognormal(-(0.35 ** 2) / 2, 0.35);
    expect(Math.abs(sum / n - 1)).toBeLessThan(0.01);
  });
});
