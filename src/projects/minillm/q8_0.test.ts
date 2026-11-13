import { describe, expect, it } from "vitest";
import data from "./data/q8-blocks.json";
import { dequantize, f16ToF32, f32ToF16, quantizeBlock } from "./q8_0";

// data/q8-blocks.json holds real SmolLM2-135M weight blocks with the bytes oracle/generate.py's
// quantize_q8_0 (minillm's reference for its C++ quantizer) writes for them.

describe("f32ToF16", () => {
  it("rounds to the nearest f16, ties to even", () => {
    expect(f32ToF16(1)).toBe(0x3c00);
    expect(f32ToF16(-2)).toBe(0xc000);
    expect(f32ToF16(65504)).toBe(0x7bff);
    expect(f32ToF16(65519)).toBe(0x7bff);
    expect(f32ToF16(65520)).toBe(0x7c00);
    expect(f32ToF16(2 ** -24)).toBe(0x0001);
    expect(f32ToF16(2 ** -25)).toBe(0x0000);
    expect(f32ToF16(3 * 2 ** -25)).toBe(0x0002);
    expect(f32ToF16(2 ** -14)).toBe(0x0400);
    expect(f32ToF16(Math.fround(0.1))).toBe(0x2e66);
    // 1 + 2^-11 is halfway between 1 and the next f16: even wins.
    expect(f32ToF16(1 + 2 ** -11)).toBe(0x3c00);
    expect(f32ToF16(1 + 3 * 2 ** -11)).toBe(0x3c02);
  });

  it("round-trips every finite f16", () => {
    for (let bits = 0; bits < 0x7c00; bits++) {
      expect(f32ToF16(f16ToF32(bits))).toBe(bits);
      expect(f32ToF16(f16ToF32(bits | 0x8000))).toBe(bits | 0x8000);
    }
  });
});

describe("quantizeBlock", () => {
  it("writes the oracle's bytes for every real block", () => {
    expect(data.blocks.length).toBeGreaterThanOrEqual(8);
    for (const block of data.blocks) {
      expect(quantizeBlock(block.values)).toEqual(block.reference);
    }
  });

  it("keeps every round-trip error within half the stored scale", () => {
    for (const block of data.blocks) {
      const q = quantizeBlock(block.values);
      const back = dequantize(q);
      const bound = f16ToF32(q.d) / 2;
      block.values.forEach((x, j) => {
        expect(Math.abs(x - (back[j] ?? Number.NaN))).toBeLessThanOrEqual(bound);
      });
      expect(Math.max(...q.qs.map(Math.abs))).toBe(127);
    }
  });

  it("rounds halves away from zero and zeroes an all-zero block", () => {
    // amax = 127 gives d = 1 exactly, so x * (1 / d) is x itself.
    const halves = [127, 2.5, -2.5, 0.5, -0.5, 1.5, ...Array.from({ length: 26 }, () => 0)];
    expect(quantizeBlock(halves).qs.slice(0, 6)).toEqual([127, 3, -3, 1, -1, 2]);
    expect(quantizeBlock(Array.from({ length: 32 }, () => 0))).toEqual({
      d: 0,
      qs: Array.from({ length: 32 }, () => 0),
    });
  });

  it("refuses what minillm refuses", () => {
    expect(() => quantizeBlock([1, 2, 3])).toThrow();
    expect(() => quantizeBlock([Number.NaN, ...Array.from({ length: 31 }, () => 0)])).toThrow();
    expect(() => quantizeBlock([1e7, ...Array.from({ length: 31 }, () => 0)])).toThrow();
  });
});
