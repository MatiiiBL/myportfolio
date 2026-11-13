// Deterministic math: e^x and ln x from operations IEEE 754 rounds exactly (+, -, *, /).
//
// Math.exp, Math.log and their relatives may differ in the last bit between JavaScript engines
// and engine versions. Pages are prerendered in Node and hydrated in the browser, so anything
// computed from them during render (a simulation, a random graph) must give the same result in
// both, or React reports a hydration mismatch; an event-driven simulation turns a one-bit
// difference into a different run. These versions return the same bits everywhere. Their
// relative error is below 1e-14 for |x| <= 6 (exp) and for any x (log), and below 1e-13 for exp
// at the ends of its range (detmath.test.ts).

const LN2 = 0.6931471805599453;
const SQRT2 = 1.4142135623730951;

/** 2^k for an integer k, by exact doublings or halvings. */
function pow2(k: number): number {
  let scale = 1;
  for (let i = 0; i < Math.abs(k); i++) scale *= 2;
  return k >= 0 ? scale : 1 / scale;
}

/** e^x: x = k ln 2 + r with |r| <= ln 2 / 2, then a Taylor series for e^r. */
export function exp(x: number): number {
  if (Number.isNaN(x)) return Number.NaN;
  if (x > 709.8) return Number.POSITIVE_INFINITY;
  if (x < -745.2) return 0;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let term = 1;
  let sum = 1;
  for (let i = 1; i < 20; i++) {
    term = (term * r) / i;
    sum += term;
  }
  // Two steps keep 2^k finite near the ends of the range.
  const half = Math.trunc(k / 2);
  return sum * pow2(half) * pow2(k - half);
}

/**
 * ln x: x = m 2^e with m in [sqrt(1/2), sqrt(2)), then ln m = 2 atanh(z) with z = (m - 1) / (m + 1),
 * |z| < 0.172, from its series.
 */
export function log(x: number): number {
  if (Number.isNaN(x) || x < 0) return Number.NaN;
  if (x === 0) return Number.NEGATIVE_INFINITY;
  if (x === Number.POSITIVE_INFINITY) return x;
  let m = x;
  let e = 0;
  while (m >= SQRT2) {
    m /= 2;
    e += 1;
  }
  while (m < SQRT2 / 2) {
    m *= 2;
    e -= 1;
  }
  const z = (m - 1) / (m + 1);
  const z2 = z * z;
  let power = z;
  let sum = 0;
  for (let k = 1; k < 40; k += 2) {
    sum += power / k;
    power *= z2;
  }
  return e * LN2 + 2 * sum;
}
