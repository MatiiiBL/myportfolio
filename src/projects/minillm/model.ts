// SmolLM2-135M's shapes, as minillm reads them from the checkpoint's config.json (the loader
// banner prints "30 layers, hidden 576, vocab 49152"; tests/common/tolerances.h measures
// attention at q[n, 9, 64] and kv[n, 3, 64]). The engine hardcodes none of them.
export const SMOLLM2 = {
  layers: 30,
  hidden: 576,
  heads: 9,
  kvHeads: 3,
  headDim: 64,
  intermediate: 1536,
  vocab: 49152,
  maxPositions: 8192,
  ropeTheta: 100000,
} as const;

export type ModelShape = typeof SMOLLM2;

/** Query heads per KV head: query head h reads KV head h / group (integer division). */
export function kvHeadOf(shape: ModelShape, head: number): number {
  return Math.floor(head / (shape.heads / shape.kvHeads));
}

/**
 * Bytes one token adds to minillm's F32 KV cache: K and V, each [layers][kv_heads][head_dim]
 * floats of 4 bytes.
 */
export function kvBytesPerToken(shape: ModelShape): number {
  return 2 * shape.layers * shape.kvHeads * shape.headDim * 4;
}

/** The same for one layer: one (layer, position) slot of K plus V. */
export function kvBytesPerSlot(shape: ModelShape): number {
  return 2 * shape.kvHeads * shape.headDim * 4;
}

/** A numerically stable softmax: the attention weights of one query over its cached keys. */
export function softmax(scores: readonly number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
