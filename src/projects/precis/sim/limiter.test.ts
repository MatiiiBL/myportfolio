import { describe, expect, it } from "vitest";
import { AIMDWindow, TokenBucket, type Outcome } from "./limiter";
import { Random } from "./random";

// The cases of Précis's tests/runtime/test_limiter.py, on the ported classes.

class ManualClock {
  t = 0;
  readonly now = () => this.t;
  advance(s: number) {
    this.t += s;
  }
}

describe("TokenBucket", () => {
  it("lets an oversized request through when full, then waits off the debt", () => {
    const clock = new ManualClock();
    const bucket = new TokenBucket(clock.now, 600, 10); // capacity 100
    expect(bucket.waitTime(500)).toBe(0);
    bucket.take(500);
    expect(bucket.level).toBe(-400);
    expect(bucket.waitTime(1)).toBeCloseTo(40.1, 9); // 500 tokens at 10 per second
  });

  it("admits everything until a rate is learned", () => {
    const clock = new ManualClock();
    const bucket = new TokenBucket(clock.now, null, 10);
    expect(bucket.waitTime(1e9)).toBe(0);
    bucket.learn(60);
    expect(bucket.ratePerMin).toBe(60);
    expect(bucket.capacity).toBe(10);
    bucket.take(10);
    expect(bucket.waitTime(1)).toBeCloseTo(1, 9);
  });

  it("never raises a configured limit", () => {
    const bucket = new TokenBucket(new ManualClock().now, 100, 60);
    bucket.learn(1000);
    expect(bucket.ratePerMin).toBe(100);
    bucket.learn(50);
    expect(bucket.ratePerMin).toBe(50);
  });

  it("never admits more than a burst plus the refill over any window", () => {
    const rng = new Random(11);
    for (let trial = 0; trial < 150; trial++) {
      const clock = new ManualClock();
      const rate = 10 + Math.floor(rng.next() * 100_000);
      const bucket = new TokenBucket(clock.now, rate, rng.uniform(1, 60));
      const admitted: { at: number; amount: number; overshoot: number }[] = [];
      const n = 1 + Math.floor(rng.next() * 60);
      for (let i = 0; i < n; i++) {
        clock.advance(rng.uniform(0, 5));
        const reserved = rng.uniform(0.01, 1) * bucket.capacity;
        clock.advance(bucket.waitTime(reserved));
        bucket.take(reserved);
        const actual = reserved * rng.uniform(0.5, 2);
        bucket.credit(reserved - actual);
        admitted.push({ at: clock.t, amount: actual, overshoot: Math.max(0, actual - reserved) });
      }
      admitted.forEach((start, i) => {
        let total = 0;
        for (const r of admitted.slice(i)) {
          total += r.amount;
          const bound = bucket.capacity + (rate / 60) * (r.at - start.at) + r.overshoot;
          expect(total).toBeLessThanOrEqual(bound * (1 + 1e-9) + 1e-9);
        }
      });
    }
  });
});

describe("AIMDWindow", () => {
  it("never admits beyond its limit", () => {
    const rng = new Random(5);
    const outcomes: Outcome[] = ["success", "overload", "failure"];
    for (let trial = 0; trial < 200; trial++) {
      const maximum = 1 + Math.floor(rng.next() * 64);
      const window = new AIMDWindow(1 + Math.floor(rng.next() * 32), maximum);
      const holders: number[] = [];
      for (let op = 0; op < 300; op++) {
        if (rng.next() < 0.5 && window.canAdmit()) {
          expect(window.inFlight).toBeLessThan(Math.floor(window.limit));
          holders.push(window.admit());
        } else if (holders.length > 0) {
          window.release(
            holders.shift() as number,
            outcomes[Math.floor(rng.next() * 3)] ?? "success",
          );
        }
        expect(window.inFlight).toBe(holders.length);
        expect(window.inFlight).toBeLessThanOrEqual(maximum);
        expect(window.limit).toBeGreaterThanOrEqual(1);
        expect(window.limit).toBeLessThanOrEqual(maximum);
      }
    }
  });

  it("halves once per congestion event and grows back by one per window", () => {
    const window = new AIMDWindow(8, 10);
    const epochs = Array.from({ length: 8 }, () => window.admit());
    for (const e of epochs.slice(0, 3)) window.release(e, "overload");
    expect(window.limit).toBe(4); // three overloads from one burst count once
    for (const e of epochs.slice(3)) window.release(e, "success");
    let successes = 0;
    while (window.limit < 10) {
      window.release(window.admit(), "success");
      successes += 1;
    }
    expect(successes).toBe(4 + 5 + 6 + 7 + 8 + 9 - 5);
    window.release(window.admit(), "success");
    expect(window.limit).toBe(10);
  });

  it("doubles per round trip in slow start", () => {
    const window = new AIMDWindow(8, 256);
    for (let round = 0; round < 4; round++) {
      const n = Math.floor(window.limit);
      const epochs = Array.from({ length: n }, () => window.admit());
      for (const e of epochs) window.release(e, "success");
    }
    expect(window.limit).toBe(128);
  });
});
