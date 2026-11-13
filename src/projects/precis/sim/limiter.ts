// Client-side admission control, ported from Précis (src/precis/llm/limiter.py) line for line:
// continuously refilling token buckets for requests, input and output tokens per minute, and a
// concurrency window with TCP's slow start, additive increase and halving on overload. Time is
// read from a function, so the buckets run on the simulation's virtual clock.

const SECONDS_PER_MINUTE = 60;

export class TokenBucket {
  private readonly now: () => number;
  private readonly burstS: number;
  private readonly configured: number | null;
  private rate: number | null = null;
  private levelValue = 0;
  private last: number;

  /** `ratePerMin` of null means unknown: the bucket admits everything until a rate is learned. */
  constructor(now: () => number, ratePerMin: number | null, burstS: number) {
    this.now = now;
    this.burstS = burstS;
    this.configured = ratePerMin;
    this.last = now();
    this.setRate(ratePerMin);
  }

  get ratePerMin(): number | null {
    return this.rate;
  }

  get capacity(): number {
    if (this.rate === null) return Number.POSITIVE_INFINITY;
    return Math.max(1, (this.rate * this.burstS) / SECONDS_PER_MINUTE);
  }

  get level(): number {
    this.refill();
    return this.levelValue;
  }

  private setRate(rate: number | null): void {
    this.refill();
    const wasUnknown = this.rate === null;
    this.rate = rate;
    if (rate !== null) {
      this.levelValue = wasUnknown ? this.capacity : Math.min(this.levelValue, this.capacity);
    }
  }

  /** Adopt the server's limit, or keep the configured one if it is lower. */
  learn(serverLimit: number): void {
    const rate = this.configured === null ? serverLimit : Math.min(this.configured, serverLimit);
    if (rate !== this.rate) this.setRate(rate);
  }

  private refill(): void {
    const now = this.now();
    if (this.rate !== null) {
      const refill = ((now - this.last) * this.rate) / SECONDS_PER_MINUTE;
      this.levelValue = Math.min(this.capacity, this.levelValue + refill);
    }
    this.last = now;
  }

  /** Seconds until `n` tokens can be taken; a request larger than the bucket goes when it is full. */
  waitTime(n: number): number {
    if (this.rate === null) return 0;
    this.refill();
    const need = Math.min(n, this.capacity);
    if (this.levelValue >= need) return 0;
    return ((need - this.levelValue) * SECONDS_PER_MINUTE) / this.rate;
  }

  take(n: number): void {
    this.refill();
    if (this.rate !== null) this.levelValue -= n;
  }

  /** Return `n` tokens (or charge `-n` more) once the real usage is known. */
  credit(n: number): void {
    this.refill();
    if (this.rate !== null) this.levelValue = Math.min(this.capacity, this.levelValue + n);
  }

  /** Lower the level to the server's `remaining` when the server knows of more usage. */
  clamp(remaining: number): void {
    this.refill();
    if (this.rate !== null) this.levelValue = Math.min(this.levelValue, remaining);
  }
}

export type Outcome = "success" | "overload" | "failure";

/**
 * Concurrency limit with slow start, then additive increase and halving. Every success adds a
 * slot during slow start (doubling the limit per round trip); the first overload (429 or 529)
 * halves it and ends slow start; afterwards it grows by one per window of floor(limit)
 * successes. Requests in flight when an overload arrives belong to one congestion event (the
 * epoch), so only the first of their overload signals halves the limit.
 */
export class AIMDWindow {
  readonly minimum: number;
  maximum: number;
  limit: number;
  slowStart: boolean;
  inFlight = 0;
  epoch = 0;
  private successes = 0;

  constructor(initial: number, maximum: number, minimum = 1, slowStart = true) {
    if (!(minimum >= 1 && minimum <= maximum)) throw new Error("need 1 <= minimum <= maximum");
    this.minimum = minimum;
    this.maximum = maximum;
    this.limit = Math.min(Math.max(initial, minimum), maximum);
    this.slowStart = slowStart;
  }

  canAdmit(): boolean {
    return this.inFlight < Math.floor(this.limit);
  }

  /** Take a slot (the caller checked `canAdmit`); returns the current epoch. */
  admit(): number {
    this.inFlight += 1;
    return this.epoch;
  }

  release(epoch: number, outcome: Outcome): void {
    this.inFlight -= 1;
    if (outcome === "success") {
      if (this.slowStart) {
        this.limit = Math.min(this.maximum, this.limit + 1);
        return;
      }
      this.successes += 1;
      if (this.successes >= Math.floor(this.limit)) {
        this.successes = 0;
        this.limit = Math.min(this.maximum, this.limit + 1);
      }
    } else if (outcome === "overload" && epoch === this.epoch) {
      this.limit = Math.max(this.minimum, Math.floor(this.limit / 2));
      this.slowStart = false;
      this.epoch += 1;
      this.successes = 0;
    }
  }
}
