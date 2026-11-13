import { describe, expect, it } from "vitest";
import attention from "./data/attention.json";
import reference from "./data/attention-reference.json";
import { SMOLLM2, kvBytesPerSlot, kvBytesPerToken, kvHeadOf, softmax } from "./model";

// data/attention-reference.json holds numpy's softmax of the full-precision scores, computed
// from the oracle's post-RoPE q and k; data/attention.json stores those scores to 4 decimals.

describe("SmolLM2 shapes", () => {
  it("groups three query heads per KV head", () => {
    expect(Array.from({ length: SMOLLM2.heads }, (_, h) => kvHeadOf(SMOLLM2, h))).toEqual([
      0, 0, 0, 1, 1, 1, 2, 2, 2,
    ]);
    expect(SMOLLM2.heads * SMOLLM2.headDim).toBe(SMOLLM2.hidden);
  });

  it("adds 46,080 bytes of K and V per token", () => {
    expect(kvBytesPerSlot(SMOLLM2)).toBe(1536);
    expect(kvBytesPerToken(SMOLLM2)).toBe(46080);
  });
});

describe("the attention data", () => {
  const layers = attention.layers as Record<string, number[][][]>;
  const ref = reference as Record<string, number[][][]>;

  it("is causal: position t has scores for keys 0..t only", () => {
    for (const heads of Object.values(layers)) {
      expect(heads).toHaveLength(SMOLLM2.heads);
      for (const rows of heads) {
        expect(rows).toHaveLength(attention.tokens.length);
        rows.forEach((row, t) => expect(row).toHaveLength(t + 1));
      }
    }
  });

  it("gives numpy's attention weights after a softmax", () => {
    for (const [layer, heads] of Object.entries(layers)) {
      heads.forEach((rows, h) =>
        rows.forEach((row, t) => {
          const weights = softmax(row);
          const expected = ref[layer]?.[h]?.[t] ?? [];
          expect(weights.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
          weights.forEach((w, s) => expect(Math.abs(w - (expected[s] ?? 0))).toBeLessThan(1e-4));
        }),
      );
    }
  });
});
