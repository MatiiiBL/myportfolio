import { describe, expect, it } from "vitest";
import results from "./data/results.json";
import {
  ARR,
  commandTiming,
  computeSteps,
  dmaSchedule,
  elementsWritten,
  finishStep,
  locateCycle,
  referenceProduct,
  seededInt8Matrix,
  simulateCompute,
  type GemmOp,
} from "./systolic";

function randomOp(m: number, n: number, k: number, seed: number, magnitude = 128): GemmOp {
  const clamp = (rows: number[][]) => rows.map((r) => r.map((x) => Math.min(127, x)));
  return {
    m,
    n,
    k,
    a: clamp(seededInt8Matrix(m, k, seed, magnitude)),
    b: clamp(seededInt8Matrix(n, k, seed + 1, magnitude)),
  };
}

function finalTile(op: GemmOp): number[][] {
  const snapshots = simulateCompute(op);
  const last = snapshots[snapshots.length - 1];
  if (!last) throw new Error("no snapshots");
  return last.pe.map((row) => row.map((p) => p.acc));
}

describe("the systolic array model", () => {
  it("computes A × Bᵀ for every tile shape", () => {
    let seed = 1;
    for (let m = 1; m <= ARR; m++) {
      for (let n = 1; n <= ARR; n++) {
        for (const k of [1, 2, 3, 5, 8, 13]) {
          const op = randomOp(m, n, k, seed++);
          const tile = finalTile(op);
          const expected = referenceProduct(op);
          for (let i = 0; i < ARR; i++) {
            for (let j = 0; j < ARR; j++) {
              // PEs outside the M × N tile multiply zeros and keep a zero sum.
              expect(tile[i]?.[j]).toBe(i < m && j < n ? expected[i]?.[j] : 0);
            }
          }
        }
      }
    }
  });

  it("matches the plain product at the largest sums and a long K", () => {
    const extremes: GemmOp = {
      m: ARR,
      n: ARR,
      k: 64,
      a: Array.from({ length: ARR }, () => Array.from({ length: 64 }, () => -128)),
      b: Array.from({ length: ARR }, (_, j) =>
        Array.from({ length: 64 }, () => (j % 2 ? 127 : -128)),
      ),
    };
    expect(finalTile(extremes)).toEqual(referenceProduct(extremes));
    const long = randomOp(ARR, ARR, 300, 99);
    expect(finalTile(long)).toEqual(referenceProduct(long));
  });

  it("delivers A[i][k] and B[j][k] to PE (i, j) together, at step k + i + j + 3", () => {
    const op = randomOp(6, 7, 9, 42);
    for (const snapshot of simulateCompute(op)) {
      snapshot.pe.forEach((row, i) =>
        row.forEach((p, j) => {
          const k = snapshot.step - 3 - i - j;
          const live = i < op.m && j < op.n && k >= 0 && k < op.k;
          expect(p.a.k >= 0 && p.b.k >= 0).toBe(live);
          if (live) {
            expect(p.a).toEqual({ value: op.a[i]?.[k], k });
            expect(p.b).toEqual({ value: op.b[j]?.[k], k });
          }
        }),
      );
    }
  });

  it("finishes each PE at the step the RTL timing gives, and the tile in K + M + N + 2 steps", () => {
    const op = randomOp(8, 8, 8, 7);
    const snapshots = simulateCompute(op);
    expect(snapshots).toHaveLength(computeSteps(op) + 1);
    const expected = referenceProduct(op);
    for (let i = 0; i < op.m; i++) {
      for (let j = 0; j < op.n; j++) {
        const done = finishStep(i, j, op.k) + 1;
        expect(snapshots[done]?.pe[i]?.[j]?.acc).toBe(expected[i]?.[j]);
        // One step earlier the last product is still in the product register.
        const before = snapshots[done - 1]?.pe[i]?.[j];
        expect(before?.prod.k).toBe(op.k - 1);
      }
    }
    expect(finishStep(op.m - 1, op.n - 1, op.k)).toBe(computeSteps(op) - 1);
  });

  it("rejects shapes and values the NPU would refuse", () => {
    expect(() => simulateCompute(randomOp(9, 1, 1, 1))).toThrow(RangeError);
    expect(() => simulateCompute({ m: 1, n: 1, k: 1, a: [[200]], b: [[1]] })).toThrow(RangeError);
  });
});

describe("the command timing", () => {
  it("reproduces the CYCLES measured on the RTL (docs/npu.md, section 6)", () => {
    for (const row of results.cycleTable) {
      expect(commandTiming(row, { dmaBytes: 4 }).total).toBe(row.d4);
      expect(commandTiming(row, { dmaBytes: 8 }).total).toBe(row.d8);
      expect(commandTiming(row, { dmaBytes: 16 }).total).toBe(row.d16);
      expect(commandTiming(row, { dmaBytes: 16, bKept: true }).total).toBe(row.d16BKept);
      expect(commandTiming(row, { dmaBytes: 16, aKept: true, bKept: true }).total).toBe(
        row.d16BothKept,
      );
    }
  });

  it("gives the MACs per cycle of the README's operand-reuse table", () => {
    const tile = { m: 8, n: 8, k: 1024 };
    const macs = (cycles: number) => Math.round(((8 * 8 * 1024) / cycles) * 10) / 10;
    const measured = [
      commandTiming(tile, { dmaBytes: 4 }).total,
      commandTiming(tile, { dmaBytes: 16 }).total,
      commandTiming(tile, { bKept: true }).total,
      commandTiming(tile, { aKept: true, bKept: true }).total,
    ];
    expect(measured).toEqual(results.tileSteps.map((s) => s.cycles));
    expect(measured.map(macs)).toEqual(results.tileSteps.map((s) => s.macsPerCycle));
  });

  it("loads one block per cycle and writes C one element per cycle", () => {
    const shape = { m: 5, n: 3, k: 40 };
    const timing = commandTiming(shape);
    expect(dmaSchedule(shape)).toHaveLength(timing.load - 1);
    expect(dmaSchedule(shape)[0]).toEqual({ operand: "A", row: 0, block: 0 });
    expect(dmaSchedule(shape).at(-1)).toEqual({ operand: "B", row: 2, block: 2 });
    expect(elementsWritten(shape, 6)).toBe(0);
    expect(elementsWritten(shape, 7)).toBe(1);
    expect(elementsWritten(shape, timing.writeBack - 1)).toBe(14);
    expect(elementsWritten(shape, timing.writeBack)).toBe(15);
    expect(locateCycle(timing, timing.load)).toEqual({
      phase: "compute",
      cycle: timing.load,
      inPhase: 0,
    });
    expect(locateCycle(timing, timing.total).phase).toBe("done");
  });
});
