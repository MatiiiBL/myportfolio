// minillm's Q8_0 quantizer (src/loader/quantize.cpp, specified in include/minillm/loader.h),
// reproduced bit for bit: per block of 32 floats, five IEEE-754 float32 roundings, then a clamp.
// Math.fround after each double operation gives the float32 result exactly, because a double
// carries more than twice float32's precision.

export const BLOCK = 32;
/** Bytes of one block: an f16 scale and 32 int8 values. */
export const BLOCK_BYTES = 2 + BLOCK;

const F16_INFINITY = 0x7c00;

function roundHalfEven(x: number): number {
  const floor = Math.floor(x);
  const frac = x - floor;
  if (frac > 0.5) return floor + 1;
  if (frac < 0.5) return floor;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** The f16 bits nearest a float32 value, ties to even (minillm's f32_to_f16, numpy's astype). */
export function f32ToF16(value: number): number {
  if (Number.isNaN(value)) return 0x7e00;
  const sign = value < 0 || Object.is(value, -0) ? 0x8000 : 0;
  const a = Math.abs(value);
  if (a >= 65520) return sign | F16_INFINITY;
  if (a < 2 ** -14) return sign | roundHalfEven(a * 2 ** 24);
  let e = Math.floor(Math.log2(a));
  if (2 ** e > a) e -= 1;
  else if (2 ** (e + 1) <= a) e += 1;
  // m is in [1024, 2048]; 2048 carries into the exponent through the addition below.
  const m = roundHalfEven(a * 2 ** (10 - e));
  return sign | (((e + 15) << 10) + (m - 1024));
}

/** The value of f16 bits; exact in float32 and in a double. */
export function f16ToF32(bits: number): number {
  const sign = bits & 0x8000 ? -1 : 1;
  const exponent = (bits >> 10) & 0x1f;
  const mantissa = bits & 0x3ff;
  if (exponent === 0) return sign * mantissa * 2 ** -24;
  if (exponent === 0x1f) return mantissa ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * (1024 + mantissa) * 2 ** (exponent - 25);
}

export interface Q8Block {
  /** The stored scale, as f16 bits. */
  d: number;
  /** The 32 int8 values. */
  qs: number[];
}

/**
 * quantize_q8_0 for one block of 32 float32 values:
 * d = f16(amax / 127), q = clamp(round(x * (1 / d)), -127, 127), halves rounding away from zero.
 */
export function quantizeBlock(x: readonly number[]): Q8Block {
  if (x.length !== BLOCK) throw new RangeError(`a Q8_0 block holds ${BLOCK} values`);
  let amax = 0;
  for (const v of x) {
    if (!Number.isFinite(v)) throw new RangeError("only finite values can be quantized");
    amax = Math.max(amax, Math.abs(v));
  }
  const d = f32ToF16(Math.fround(amax / 127));
  if (d === F16_INFINITY) throw new RangeError("amax / 127 overflows the f16 scale");
  const scale = f16ToF32(d);
  if (scale === 0) return { d, qs: x.map(() => 0) };
  const inv = Math.fround(1 / scale);
  const qs = x.map((v) => {
    const t = Math.fround(v * inv);
    const whole = Math.trunc(t);
    const q = Math.abs(t - whole) >= 0.5 ? whole + Math.sign(t) : whole;
    // + 0 turns -0 into 0: the stored int8 has no sign of zero.
    return Math.min(127, Math.max(-127, q)) + 0;
  });
  return { d, qs };
}

/** convert_to_f32 of a block: q * d, exact in float32. */
export function dequantize(block: Q8Block): number[] {
  const scale = f16ToF32(block.d);
  return block.qs.map((q) => q * scale);
}
