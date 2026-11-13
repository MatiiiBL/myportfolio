// A small seeded generator (mulberry32), so a simulated run is the same on every visit.
//
// Its normal and log-normal draws avoid Math.log, Math.cos and Math.exp, which may differ in the
// last bit between JavaScript engines: the page is prerendered in Node and hydrated in the
// browser, and the event-driven simulation would turn such a difference into a different run.

import { exp } from "../../../lib/detmath";

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
