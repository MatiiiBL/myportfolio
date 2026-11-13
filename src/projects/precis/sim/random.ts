// A small seeded generator (mulberry32), so a simulated run is the same on every visit.
//
// Only arithmetic that IEEE 754 rounds exactly (+, -, *, /, sqrt) is used: Math.exp, Math.log
// and Math.cos may differ in the last bit between JavaScript engines, and an event-driven
// simulation turns such a difference into a different run. The page is prerendered in Node and
// then hydrated in the browser, so both must compute the same run, which the tests check too.

const LN2 = 0.6931471805599453;

/** e^x from basic operations: x = k ln 2 + r with |r| <= ln 2 / 2, then a Taylor series. */
export function exp(x: number): number {
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let term = 1;
  let sum = 1;
  for (let i = 1; i < 20; i++) {
    term = (term * r) / i;
    sum += term;
  }
  let scale = 1;
  for (let i = 0; i < Math.abs(k); i++) scale *= 2;
  return k >= 0 ? sum * scale : sum / scale;
}

export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Uniform in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(low: number, high: number): number {
    return low + (high - low) * this.next();
  }

  /** An approximately standard normal draw: the sum of twelve uniforms, minus six. */
  normal(): number {
    let sum = 0;
    for (let i = 0; i < 12; i++) sum += this.next();
    return sum - 6;
  }

  /** Log-normal with the given parameters of the underlying normal, as Python's lognormvariate. */
  lognormal(mu: number, sigma: number): number {
    return exp(mu + sigma * this.normal());
  }
}
