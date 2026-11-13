// A small discrete-event model of Précis's per-paper pipeline running against a rate-limited
// API, following the code the benchmarks run (src/precis/pipeline/scheduler.py,
// src/precis/llm/gateway.py, src/precis/llm/fake.py, src/precis/eval/bench.py):
//
// - the scheduler keeps 2 x ceiling papers in flight and runs each paper's stages in order,
//   one request (agent turn) at a time;
// - the gateway answers a request from the response cache when it can; otherwise it waits for a
//   slot under the AIMD window, then for the request, input and output token buckets (limits
//   learned from the response headers), and retries 429, 529, 5xx and timeouts the way the
//   gateway does;
// - the fake server enforces its own per-minute buckets, answers 529 above an overload
//   threshold and injects faults, with the benchmark's latency model.
//
// Time is virtual and jumps from event to event, as with Précis's VirtualClock, so a run is
// deterministic for a seed. A run can be killed at a given time and resumed: the store (stage
// records, the paid calls and the response cache, filed together) survives, everything held in
// memory does not.

import { AIMDWindow, TokenBucket, type Outcome } from "./limiter";
import { Random } from "./random";

export interface ServerLimits {
  rpm: number;
  itpm: number;
  otpm: number;
}

export interface Faults {
  rateLimit: number;
  overloaded: number;
  serverError: number;
  timeout: number;
}

export interface Scenario {
  papers: number;
  /** The gateway's concurrency ceiling (`limits.max_concurrency`). */
  ceiling: number;
  /** Server limits per minute; null for none (the overload experiment). */
  limits: ServerLimits | null;
  /** The server answers 529 to a request arriving while more than this many are in flight. */
  overloadAbove: number | null;
  faults: Faults;
  seed: number;
  /** Simulated second at which the run is killed (SIGKILL), if any. */
  killAt?: number;
  /** Simulated seconds between the kill and the resumed run's start. */
  resumeDelay?: number;
}

/** The benchmark's settings (src/precis/config.py, BenchConfig; src/precis/eval/bench.py). */
export const BENCH_LIMITS: ServerLimits = { rpm: 4000, itpm: 2_000_000, otpm: 400_000 };
export const NO_FAULTS: Faults = { rateLimit: 0, overloaded: 0, serverError: 0, timeout: 0 };
export const BENCH_FAULTS: Faults = {
  rateLimit: 0.04,
  overloaded: 0.02,
  serverError: 0.02,
  timeout: 0.01,
};

// Gateway defaults (src/precis/config.py, LimitsConfig) and the fake's (src/precis/llm/fake.py).
const INITIAL_CONCURRENCY = 8;
const CLIENT_BURST_S = 10;
const SERVER_BURST_S = 60;
const MAX_ATTEMPTS = 8;
const BACKOFF_BASE_S = 1;
const BACKOFF_MAX_S = 60;
const RETRY_AFTER_S = 5;
const TIMEOUT_S = 30;
const ERROR_S = 0.1;
const FIRST_TOKEN_S = 2;
const SECONDS_PER_OUTPUT_TOKEN = 0.02;
const JITTER = 0.35;
const DEFAULT_OUTPUT_ESTIMATE = 1000;
const EWMA_WEIGHT = 0.2;
// The smallest sleep, as the virtual clock rounds waits up to a timer tick.
const TICK = 0.001;

// The workload: per request, the input tokens the limits count (uncached input and cache
// writes) and the output tokens, with the means of results/bench-throughput.json (2,326 and
// 201); per paper, the requests of each stage: read 2 turns (3 when the first submission is
// rejected, 20% in docs/agents.md), verify 2, and revise 4 for the papers that need it, at the
// rate that gives the benchmark's 5.02 requests per paper.
const MEAN_INPUT = 2326;
const MEAN_OUTPUT = 201;
const TOKEN_SIGMA = 0.4;
const REJECTED = 0.2;
const REVISED = 0.2055;

export type Stage = "read" | "verify" | "revise";
export const STAGES: Stage[] = ["read", "verify", "revise"];

/** A paper's state, for drawing: 0 waiting, 1-3 a stage, 4 done, 5 failed. */
export type PaperState = 0 | 1 | 2 | 3 | 4 | 5;
export const STATE_OF: Record<Stage, PaperState> = { read: 1, verify: 2, revise: 3 };

interface Request {
  hash: string;
  input: number;
  output: number;
}

interface PaperPlan {
  stages: { stage: Stage; requests: Request[] }[];
}

export function planPapers(n: number, seed: number): PaperPlan[] {
  const rng = new Random(seed ^ 0x5eed);
  const tokens = (mean: number) =>
    Math.max(1, Math.round(mean * rng.lognormal(-(TOKEN_SIGMA ** 2) / 2, TOKEN_SIGMA)));
  return Array.from({ length: n }, (_, paper) => {
    const counts: [Stage, number][] = [
      ["read", rng.next() < REJECTED ? 3 : 2],
      ["verify", 2],
    ];
    if (rng.next() < REVISED) counts.push(["revise", 4]);
    return {
      stages: counts.map(([stage, count]) => ({
        stage,
        requests: Array.from({ length: count }, (_, turn) => ({
          hash: `${paper}/${stage}/${turn}`,
          input: tokens(MEAN_INPUT),
          output: tokens(MEAN_OUTPUT),
        })),
      })),
    };
  });
}

export interface Sample {
  t: number;
  /** The AIMD window's limit, and the requests holding a slot (sent or waiting for buckets). */
  limit: number;
  holding: number;
  /** Requests the server is working on. */
  sending: number;
  done: number;
  /** Papers in each state, indexed by PaperState. */
  states: number[];
  /** Fill of the client's request, input and output buckets (0-1; 1 while still unknown). */
  buckets: [number, number, number];
}

export interface Transition {
  t: number;
  paper: number;
  state: PaperState;
}

export interface Totals {
  /** Requests answered by the server and paid for. */
  paid: number;
  /** Requests served from the response cache, at no cost. */
  cached: number;
  retries: number;
  rateLimited: number;
  overloaded: number;
  serverErrors: number;
  timeouts: number;
  /** Request hashes with more than one paid answer. */
  paidTwice: number;
  papersDone: number;
  papersFailed: number;
  /** Papers whose stages are not all finished at the end. */
  papersLost: number;
  inputTokens: number;
  outputTokens: number;
}

export interface KillReport {
  at: number;
  resumedAt: number;
  finishedAtKill: number;
  stagesRunning: number;
  /** Sent to the server and not yet answered when the run was killed. */
  inFlight: number;
  /** Of those, sent again by the resumed run (their answers were never filed). */
  resent: number;
  /** Turns of interrupted stages that the resumed run replayed from the cache. */
  replayed: number;
}

export interface RunResult {
  scenario: Scenario;
  samples: Sample[];
  transitions: Transition[];
  totals: Totals;
  /** Simulated seconds until the last paper finished. */
  duration: number;
  /** Paper latency from its first request to its last answer, in seconds. */
  paperLatencies: number[];
  kill: KillReport | null;
}

// ---------------------------------------------------------------------------------------------

class EventQueue {
  private heap: { t: number; seq: number; run: () => void }[] = [];
  private seq = 0;
  now = 0;

  at(t: number, run: () => void): void {
    const e = { t: Math.max(t, this.now), seq: this.seq++, run };
    const h = this.heap;
    h.push(e);
    let i = h.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (before(h[p] as typeof e, e)) break;
      h[i] = h[p] as typeof e;
      i = p;
    }
    h[i] = e;
  }

  after(delay: number, run: () => void): void {
    this.at(this.now + delay, run);
  }

  /** Run events in order until `until` or none are left; false when empty. */
  step(until: number): boolean {
    const h = this.heap;
    while (h.length > 0) {
      const top = h[0] as (typeof h)[number];
      if (top.t > until) return true;
      const last = h.pop() as (typeof h)[number];
      if (h.length > 0) {
        let i = 0;
        for (;;) {
          const l = 2 * i + 1;
          const r = l + 1;
          let m = i;
          if (l < h.length && before(h[l] as typeof last, m === i ? last : (h[m] as typeof last)))
            m = l;
          if (r < h.length && before(h[r] as typeof last, m === i ? last : (h[m] as typeof last)))
            m = r;
          if (m === i) break;
          h[i] = h[m] as typeof last;
          i = m;
        }
        h[i] = last;
      }
      this.now = top.t;
      top.run();
    }
    return false;
  }
}

function before(a: { t: number; seq: number }, b: { t: number; seq: number }): boolean {
  return a.t < b.t || (a.t === b.t && a.seq < b.seq);
}

// ---------------------------------------------------------------------------------------------

/** What outlives a process: the SQLite store and the server. */
interface Durable {
  stageDone: Set<string>;
  /** Paid answers per request hash: the LLMCall rows with status "ok". */
  paid: Map<string, number>;
  /** The response cache, written in the same transaction as the call. */
  cache: Set<string>;
  failed: Set<number>;
}

type Reply =
  | { kind: "ok"; input: number; output: number }
  | { kind: "429"; retryAfter: number }
  | { kind: "529" }
  | { kind: "500" }
  | { kind: "timeout" };

class Server {
  inFlight = 0;
  private readonly buckets: [TokenBucket, TokenBucket, TokenBucket] | null;

  constructor(
    private readonly q: EventQueue,
    private readonly rng: Random,
    private readonly limits: ServerLimits | null,
    private readonly overloadAbove: number | null,
    private readonly faults: Faults,
    private readonly totals: Totals,
  ) {
    const now = () => q.now;
    this.buckets = limits
      ? [
          new TokenBucket(now, limits.rpm, SERVER_BURST_S),
          new TokenBucket(now, limits.itpm, SERVER_BURST_S),
          new TokenBucket(now, limits.otpm, SERVER_BURST_S),
        ]
      : null;
  }

  /** The rate-limit headers: each limit and what remains of it. */
  headers(): { limit: number; remaining: number }[] | null {
    if (!this.buckets || !this.limits) return null;
    const l = this.limits;
    return [l.rpm, l.itpm, l.otpm].map((limit, i) => ({
      limit,
      remaining: Math.max(0, Math.floor((this.buckets as TokenBucket[])[i]?.level ?? 0)),
    }));
  }

  /** Serve one request; `done` is called with the outcome when the server answers. */
  send(req: Request, done: (reply: Reply) => void): void {
    this.inFlight += 1;
    const finish = (delay: number, reply: Reply) =>
      this.q.after(delay, () => {
        this.inFlight -= 1;
        done(reply);
      });
    const fault = this.pickFault();
    if (fault === "timeout") {
      this.totals.timeouts += 1;
      finish(TIMEOUT_S, { kind: "timeout" });
      return;
    }
    if (fault === "429") {
      this.totals.rateLimited += 1;
      finish(ERROR_S, { kind: "429", retryAfter: RETRY_AFTER_S });
      return;
    }
    if (fault === "529") {
      this.totals.overloaded += 1;
      finish(ERROR_S, { kind: "529" });
      return;
    }
    if (fault === "500") {
      this.totals.serverErrors += 1;
      finish(ERROR_S, { kind: "500" });
      return;
    }
    if (this.buckets) {
      const [requests, inputs, outputs] = this.buckets;
      const wait = Math.max(
        requests.waitTime(1),
        inputs.waitTime(req.input),
        outputs.level > 0 ? 0 : outputs.waitTime(1),
      );
      if (wait > 0) {
        this.totals.rateLimited += 1;
        finish(0, { kind: "429", retryAfter: Math.ceil(wait) });
        return;
      }
      requests.take(1);
      inputs.take(req.input);
    }
    const mean = FIRST_TOKEN_S + req.output * SECONDS_PER_OUTPUT_TOKEN;
    const latency = mean * this.rng.lognormal(-(JITTER ** 2) / 2, JITTER);
    this.q.after(latency, () => {
      this.inFlight -= 1;
      this.buckets?.[2].take(req.output);
      done({ kind: "ok", input: req.input, output: req.output });
    });
  }

  private pickFault(): "429" | "529" | "500" | "timeout" | null {
    if (this.overloadAbove !== null && this.inFlight > this.overloadAbove) return "529";
    let draw = this.rng.next();
    const odds: ["429" | "529" | "500" | "timeout", number][] = [
      ["429", this.faults.rateLimit],
      ["529", this.faults.overloaded],
      ["500", this.faults.serverError],
      ["timeout", this.faults.timeout],
    ];
    for (const [kind, p] of odds) {
      if (draw < p) return kind;
      draw -= p;
    }
    return null;
  }
}

/** One process: the scheduler and the gateway with their in-memory state. */
class Process {
  alive = true;
  readonly window: AIMDWindow;
  readonly buckets: [TokenBucket, TokenBucket, TokenBucket];
  private pausedUntil = Number.NEGATIVE_INFINITY;
  private readonly slotWaiters: ((epoch: number) => void)[] = [];
  private readonly tokenWaiters: { input: number; output: number; go: () => void }[] = [];
  private tokenWake = false;
  private outputAverage = new Map<Stage, number>();
  /** Requests sent and not yet answered, by hash. */
  readonly sent = new Set<string>();
  /** Papers whose stage is running, by index. */
  readonly running = new Set<number>();
  private readonly queue: number[];
  private active = 0;

  constructor(
    private readonly sim: Simulation,
    papers: number[],
  ) {
    const now = () => sim.q.now;
    this.window = new AIMDWindow(
      Math.min(INITIAL_CONCURRENCY, sim.scenario.ceiling),
      sim.scenario.ceiling,
    );
    this.buckets = [
      new TokenBucket(now, null, CLIENT_BURST_S),
      new TokenBucket(now, null, CLIENT_BURST_S),
      new TokenBucket(now, null, CLIENT_BURST_S),
    ];
    this.queue = papers;
    for (let i = 0; i < 2 * sim.scenario.ceiling; i++) this.nextPaper();
  }

  private nextPaper(): void {
    const paper = this.queue.shift();
    if (paper === undefined) return;
    this.active += 1;
    this.runStage(paper, 0);
  }

  private finishPaper(paper: number, state: PaperState): void {
    this.sim.mark(paper, state);
    this.active -= 1;
    this.nextPaper();
  }

  private runStage(paper: number, index: number): void {
    if (!this.alive) return;
    const plan = this.sim.plans[paper] as PaperPlan;
    const stage = plan.stages[index];
    if (!stage) {
      this.running.delete(paper);
      this.finishPaper(paper, 4);
      return;
    }
    const key = `${paper}/${stage.stage}`;
    if (this.sim.durable.stageDone.has(key)) {
      this.runStage(paper, index + 1);
      return;
    }
    this.running.add(paper);
    this.sim.mark(paper, STATE_OF[stage.stage]);
    const turn = (n: number) => {
      const req = stage.requests[n];
      if (!req) {
        this.sim.durable.stageDone.add(key);
        this.runStage(paper, index + 1);
        return;
      }
      this.create(req, stage.stage, paper, (ok) => {
        if (!ok) {
          this.sim.durable.failed.add(paper);
          this.running.delete(paper);
          this.finishPaper(paper, 5);
          return;
        }
        turn(n + 1);
      });
    };
    turn(0);
  }

  // The gateway: cache, admission, send, retries (gateway.py, `create` and `_send_online`).
  private create(req: Request, stage: Stage, paper: number, done: (ok: boolean) => void): void {
    const sim = this.sim;
    sim.touch(paper);
    if (sim.durable.cache.has(req.hash)) {
      sim.totals.cached += 1;
      if (sim.resumed) sim.replayed += 1;
      sim.q.after(0, () => {
        if (this.alive) done(true);
      });
      return;
    }
    const estimate = {
      input: req.input,
      output: Math.round(this.outputAverage.get(stage) ?? DEFAULT_OUTPUT_ESTIMATE),
    };
    let timeouts = 0;
    const attempt = (n: number) => {
      this.acquire(estimate.input, estimate.output, (epoch) => {
        this.sent.add(req.hash);
        if (sim.resumed && sim.inFlightAtKill.has(req.hash)) sim.resent += 1;
        sim.server.send(req, (reply) => {
          if (!this.alive) return;
          this.sent.delete(req.hash);
          const retry = (outcome: Outcome, delay: number, refund: boolean) => {
            this.release(epoch, outcome, refund ? estimate : null, null);
            if (n === MAX_ATTEMPTS) {
              done(false);
              return;
            }
            sim.totals.retries += 1;
            sim.q.after(delay, () => {
              if (this.alive) attempt(n + 1);
            });
          };
          switch (reply.kind) {
            case "ok": {
              this.release(epoch, "success", estimate, reply);
              this.observe();
              const avg = this.outputAverage.get(stage);
              this.outputAverage.set(
                stage,
                avg === undefined
                  ? reply.output
                  : (1 - EWMA_WEIGHT) * avg + EWMA_WEIGHT * reply.output,
              );
              // The call record and its cache entry are written in one transaction.
              sim.durable.paid.set(req.hash, (sim.durable.paid.get(req.hash) ?? 0) + 1);
              sim.durable.cache.add(req.hash);
              sim.totals.paid += 1;
              sim.totals.inputTokens += reply.input;
              sim.totals.outputTokens += reply.output;
              sim.touch(paper);
              done(true);
              return;
            }
            case "429":
              this.observe();
              this.pause(reply.retryAfter);
              retry("overload", reply.retryAfter + sim.rng.uniform(0, BACKOFF_BASE_S), true);
              return;
            case "529":
              retry("overload", this.backoff(n), true);
              return;
            case "500":
              retry("failure", this.backoff(n), true);
              return;
            case "timeout":
              timeouts += 1;
              if (timeouts > 1) {
                this.release(epoch, "failure", estimate, null);
                done(false);
                return;
              }
              retry("failure", this.backoff(n), true);
          }
        });
      });
    };
    attempt(1);
  }

  private backoff(attempt: number): number {
    return this.sim.rng.uniform(0, Math.min(BACKOFF_MAX_S, BACKOFF_BASE_S * 2 ** (attempt - 1)));
  }

  // Admission (limiter.py, `Admission`): a slot first, then bucket capacity, in arrival order.
  private acquire(input: number, output: number, go: (epoch: number) => void): void {
    const tokens = (epoch: number) => {
      this.tokenWaiters.push({ input, output, go: () => go(epoch) });
      this.pumpTokens();
    };
    if (this.slotWaiters.length === 0 && this.window.canAdmit()) {
      tokens(this.window.admit());
    } else {
      this.slotWaiters.push(tokens);
    }
  }

  private pumpTokens(): void {
    if (this.tokenWake || !this.alive) return;
    const q = this.sim.q;
    const [requests, inputs, outputs] = this.buckets;
    for (;;) {
      const head = this.tokenWaiters[0];
      if (!head) return;
      const wait = Math.max(
        this.pausedUntil - q.now,
        requests.waitTime(1),
        inputs.waitTime(head.input),
        outputs.waitTime(head.output),
      );
      if (wait > 0) {
        this.tokenWake = true;
        q.after(Math.max(wait, TICK), () => {
          this.tokenWake = false;
          this.pumpTokens();
        });
        return;
      }
      this.tokenWaiters.shift();
      requests.take(1);
      inputs.take(head.input);
      outputs.take(head.output);
      head.go();
    }
  }

  private release(
    epoch: number,
    outcome: Outcome,
    reserved: { input: number; output: number } | null,
    used: { input: number; output: number } | null,
  ): void {
    if (reserved) {
      this.buckets[1].credit(reserved.input - (used?.input ?? 0));
      this.buckets[2].credit(reserved.output - (used?.output ?? 0));
    }
    this.window.release(epoch, outcome);
    while (this.slotWaiters.length > 0 && this.window.canAdmit()) {
      const next = this.slotWaiters.shift();
      next?.(this.window.admit());
    }
  }

  private pause(seconds: number): void {
    this.pausedUntil = Math.max(this.pausedUntil, this.sim.q.now + seconds);
  }

  private observe(): void {
    const headers = this.sim.server.headers();
    if (!headers) return;
    headers.forEach((h, i) => {
      const bucket = this.buckets[i] as TokenBucket;
      bucket.learn(h.limit);
      bucket.clamp(h.remaining);
    });
  }

  get finished(): boolean {
    return this.active === 0 && this.queue.length === 0;
  }
}

class Simulation {
  readonly q = new EventQueue();
  readonly rng: Random;
  readonly plans: PaperPlan[];
  readonly durable: Durable = {
    stageDone: new Set(),
    paid: new Map(),
    cache: new Set(),
    failed: new Set(),
  };
  readonly totals: Totals = {
    paid: 0,
    cached: 0,
    retries: 0,
    rateLimited: 0,
    overloaded: 0,
    serverErrors: 0,
    timeouts: 0,
    paidTwice: 0,
    papersDone: 0,
    papersFailed: 0,
    papersLost: 0,
    inputTokens: 0,
    outputTokens: 0,
  };
  readonly server: Server;
  readonly transitions: Transition[] = [];
  readonly state: PaperState[];
  readonly first: number[];
  readonly last: number[];
  process: Process;
  resumed = false;
  replayed = 0;
  resent = 0;
  inFlightAtKill = new Set<string>();

  constructor(readonly scenario: Scenario) {
    this.rng = new Random(scenario.seed);
    this.plans = planPapers(scenario.papers, scenario.seed);
    this.state = Array<PaperState>(scenario.papers).fill(0);
    this.first = Array<number>(scenario.papers).fill(Number.NaN);
    this.last = Array<number>(scenario.papers).fill(Number.NaN);
    this.server = new Server(
      this.q,
      this.rng,
      scenario.limits,
      scenario.overloadAbove,
      scenario.faults,
      this.totals,
    );
    this.process = new Process(this, this.unfinished());
  }

  unfinished(): number[] {
    return this.plans.map((_, i) => i).filter((i) => this.state[i] !== 4 && this.state[i] !== 5);
  }

  mark(paper: number, state: PaperState): void {
    if (this.state[paper] === state) return;
    this.state[paper] = state;
    this.transitions.push({ t: this.q.now, paper, state });
  }

  touch(paper: number): void {
    if (Number.isNaN(this.first[paper])) this.first[paper] = this.q.now;
    this.last[paper] = this.q.now;
  }
}

/** Run a scenario to the end and record what a viewer needs to replay it. */
export function simulate(scenario: Scenario): RunResult {
  const sim = new Simulation(scenario);
  const samples: Sample[] = [];
  const counts = () => {
    const c = [0, 0, 0, 0, 0, 0];
    for (const s of sim.state) c[s] = (c[s] ?? 0) + 1;
    return c;
  };
  const sample = () => {
    const p = sim.process;
    const fill = (b: TokenBucket) =>
      b.ratePerMin === null ? 1 : Math.max(0, Math.min(1, b.level / b.capacity));
    const states = counts();
    samples.push({
      t: sim.q.now,
      limit: p.alive ? Math.floor(p.window.limit) : 0,
      holding: p.alive ? p.window.inFlight : 0,
      sending: sim.server.inFlight,
      done: states[4] ?? 0,
      states,
      buckets: [fill(p.buckets[0]), fill(p.buckets[1]), fill(p.buckets[2])],
    });
  };

  const killed: { report: KillReport | null } = { report: null };
  const killAt = scenario.killAt;
  if (killAt !== undefined) {
    sim.q.at(killAt, () => {
      const p = sim.process;
      p.alive = false;
      sim.inFlightAtKill = new Set(p.sent);
      const finishedAtKill = sim.state.filter((s) => s === 4).length;
      // A crashed run leaves its stages `running`; the next run resets them to pending.
      for (const paper of p.running) sim.mark(paper, 0);
      const resumeAt = killAt + (scenario.resumeDelay ?? 5);
      killed.report = {
        at: killAt,
        resumedAt: resumeAt,
        finishedAtKill,
        stagesRunning: p.running.size,
        inFlight: p.sent.size,
        resent: 0,
        replayed: 0,
      };
      sim.q.at(resumeAt, () => {
        sim.resumed = true;
        sim.process = new Process(sim, sim.unfinished());
      });
    });
  }

  for (let t = 0; ; t += 1) {
    const more = sim.q.step(t);
    // Nothing is left before t, so the clock can move there for the sample.
    sim.q.now = Math.max(sim.q.now, t);
    sample();
    const settled = sim.process.finished && (killAt === undefined || sim.resumed);
    if (!more || (settled && sim.server.inFlight === 0)) break;
    if (t > 24 * 3600) throw new Error("the simulation did not finish");
  }

  const totals = sim.totals;
  for (const n of sim.durable.paid.values()) if (n > 1) totals.paidTwice += 1;
  totals.papersDone = sim.state.filter((s) => s === 4).length;
  totals.papersFailed = sim.state.filter((s) => s === 5).length;
  totals.papersLost = scenario.papers - totals.papersDone - totals.papersFailed;
  const lastDone = sim.transitions.reduce((m, tr) => (tr.state >= 4 ? Math.max(m, tr.t) : m), 0);
  const report = killed.report;
  return {
    scenario,
    samples,
    transitions: sim.transitions,
    totals,
    duration: lastDone,
    paperLatencies: sim.first
      .map((first, i) => (sim.last[i] ?? first) - first)
      .filter((x) => !Number.isNaN(x)),
    kill: report ? { ...report, resent: sim.resent, replayed: sim.replayed } : null,
  };
}

/** Papers finished per minute over the minute before each sample. */
export function papersPerMinute(samples: Sample[]): number[] {
  return samples.map((s, i) => {
    const j = Math.max(0, i - 60);
    const earlier = samples[j] as Sample;
    const span = s.t - earlier.t;
    return span > 0 ? ((s.done - earlier.done) * 60) / span : 0;
  });
}
