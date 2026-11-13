import { describe, expect, it } from "vitest";
import fixture from "../data/matmul-schedules.json";
import { interpret, script, type Arrays, type PrimFunc } from "./ir";
import {
  DOC_KERNEL,
  defaultConfig,
  knobSpace,
  scheduleMatmul,
  unscheduled,
  type MatmulConfig,
  type MatmulShape,
} from "./matmul";
import { tileSteps } from "./tiles";

// FNV-1a, 64 bits, over the UTF-8 bytes (the text is ASCII), as data/SOURCE.md describes.
function fnv64(text: string): string {
  let h = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    h ^= BigInt(byte);
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return h.toString(16).padStart(16, "0");
}

function everyConfig(shape: MatmulShape): MatmulConfig[] {
  const s = knobSpace(shape);
  const out: MatmulConfig[] = [];
  for (const tile_m of s.tile_m)
    for (const tile_n of s.tile_n)
      for (const order of s.order)
        for (const pack_b of s.pack_b)
          for (const parallel of s.parallel) out.push({ tile_m, tile_n, order, pack_b, parallel });
  return out;
}

const key = (c: MatmulConfig) =>
  `${c.tile_m},${c.tile_n},${c.order},${Number(c.pack_b)},${Number(c.parallel)}`;

describe("the matmul template matches Tessera", () => {
  it("has the same knobs and defaults", () => {
    expect(knobSpace(DOC_KERNEL)).toEqual(fixture.knobs);
    expect(defaultConfig(DOC_KERNEL)).toEqual(fixture.defaults);
  });

  it("prints the unscheduled function as tir.script does", () => {
    expect(script(unscheduled(DOC_KERNEL))).toBe(fixture.unscheduled);
  });

  it("prints the default schedule and its trace as Tessera does", () => {
    const s = scheduleMatmul(DOC_KERNEL, defaultConfig(DOC_KERNEL));
    expect(s.trace).toEqual(fixture.default.trace);
    expect(script(s.func)).toBe(fixture.default.ir);
  });

  it("produces Tessera's trace and loop IR at every point of the space", () => {
    const configs = everyConfig(DOC_KERNEL);
    expect(configs).toHaveLength(Object.keys(fixture.hashes).length);
    const hashes: Record<string, string> = fixture.hashes;
    for (const cfg of configs) {
      const s = scheduleMatmul(DOC_KERNEL, cfg);
      expect(fnv64(`${s.trace.join("\n")}\n\n${script(s.func)}`), key(cfg)).toBe(hashes[key(cfg)]);
    }
  });
});

// A deterministic generator, so a failure reproduces.
function values(n: number, seed: number): Float64Array {
  const out = new Float64Array(n);
  let x = seed;
  for (let i = 0; i < n; i++) {
    x = (x * 1103515245 + 12345) % 2147483648;
    out[i] = x / 1073741824 - 1;
  }
  return out;
}

function run(
  func: PrimFunc,
  shape: MatmulShape,
  a: Float64Array,
  w: Float64Array,
  b: Float64Array,
) {
  const arrays: Arrays = {
    A: a,
    W: w,
    b,
    relu: new Float64Array(shape.m * shape.n).fill(Number.NaN),
  };
  for (const alloc of func.allocs) {
    arrays[alloc.name] = new Float64Array(alloc.shape.reduce((x, y) => x * y, 1)).fill(Number.NaN);
  }
  interpret(func, arrays);
  return arrays.relu as Float64Array;
}

function reference(shape: MatmulShape, a: Float64Array, w: Float64Array, b: Float64Array) {
  const out = new Float64Array(shape.m * shape.n);
  for (let i = 0; i < shape.m; i++)
    for (let j = 0; j < shape.n; j++) {
      let acc = 0;
      for (let k = 0; k < shape.k; k++)
        acc += (a[i * shape.k + k] as number) * (w[k * shape.n + j] as number);
      out[i * shape.n + j] = Math.max(acc + (b[j] as number), 0);
    }
  return out;
}

function expectClose(actual: Float64Array, expected: Float64Array) {
  expect(actual.length).toBe(expected.length);
  let worst = 0;
  actual.forEach((x, i) => {
    worst = Math.max(worst, Math.abs(x - (expected[i] as number)));
  });
  expect(worst).toBeLessThan(1e-9);
}

describe("schedules preserve the result", () => {
  const small: MatmulShape = { m: 8, n: 12, k: 5 };
  const a = values(small.m * small.k, 1);
  const w = values(small.k * small.n, 2);
  const b = values(small.n, 3);
  const expected = reference(small, a, w, b);

  it("interprets the unscheduled function to relu(A @ W + b)", () => {
    expectClose(run(unscheduled(small), small, a, w, b), expected);
  });

  it("gives the same result at every point of a small kernel's space", () => {
    for (const cfg of everyConfig(small)) {
      expectClose(run(scheduleMatmul(small, cfg).func, small, a, w, b), expected);
    }
  });

  it("gives the same result for the documented kernel's default schedule", () => {
    const s = DOC_KERNEL;
    const [da, dw, db] = [values(s.m * s.k, 4), values(s.k * s.n, 5), values(s.n, 6)];
    const out = run(scheduleMatmul(s, defaultConfig(s)).func, s, da, dw, db);
    expectClose(out, reference(s, da, dw, db));
  });
});

describe("tile order", () => {
  it("is the order in which the interpreted loop nest starts its tiles", () => {
    const shape: MatmulShape = { m: 8, n: 12, k: 3 };
    for (const cfg of everyConfig(shape)) {
      const { func } = scheduleMatmul(shape, cfg);
      const seen: string[] = [];
      const arrays: Arrays = {
        A: values(shape.m * shape.k, 7),
        W: values(shape.k * shape.n, 8),
        b: values(shape.n, 9),
        relu: new Float64Array(shape.m * shape.n),
        matmul_local: new Float64Array(shape.m * shape.n),
        W_local: new Float64Array(shape.k * shape.n),
      };
      interpret(func, arrays, (block, iters) => {
        const at = (name: string) => iters.get(name) ?? -1;
        if (block.name === "W_local" && at("v0_1") === 0 && at("v1_1") % cfg.tile_n === 0) {
          seen.push(`pack ${at("v1_1") / cfg.tile_n}`);
        }
        if (block.name === "matmul_init" && at("v_m_1") % cfg.tile_m === 0) {
          if (at("v_n_1") % cfg.tile_n === 0) {
            seen.push(`tile ${at("v_m_1") / cfg.tile_m},${at("v_n_1") / cfg.tile_n}`);
          }
        }
      });
      const expected = tileSteps(shape, cfg).flatMap((s) => [
        ...(s.packs ? [`pack ${s.col}`] : []),
        `tile ${s.row},${s.col}`,
      ]);
      expect(seen, key(cfg)).toEqual(expected);
    }
  });
});
