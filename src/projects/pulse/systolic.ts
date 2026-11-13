// A cycle-level model of one Pulse NPU command, written from the RTL of
// github.com/MatiiiBL/riscv-npu-soc (rtl/npu/npu_opbuf.sv, npu_array.sv, npu_pe.sv, npu_top.sv)
// and its notes (docs/npu.md). It keeps the same registers the hardware has, so the stepper on
// the Pulse page shows what the array holds at every clock edge, not an idealized wavefront.

/** The array is ARR × ARR processing elements (PEs). */
export const ARR = 8;
/** Bytes the DMA moves per cycle on DMEM port B in the default SoC (NPU_DMA_BYTES). */
export const DMA_BYTES = 16;
/** Write-back stages after an element is issued: S1..S6 of npu_wb.sv. */
const WB_LATENCY = 6;

/** C = A × Bᵀ for INT8 A (M × K) and B (N × K): B holds a layer's weights row by row. */
export interface GemmOp {
  m: number;
  n: number;
  k: number;
  a: number[][];
  b: number[][];
}

/**
 * A value in a pipeline register. `k` is the inner index it carries, or -1 for the zero a
 * feeder outputs outside 0..K-1 (or past M / N): the hardware has no valid bits, idle PEs just
 * multiply by zero. The index is bookkeeping for the picture and the tests, not hardware state.
 */
export interface Operand {
  value: number;
  k: number;
}

export interface PeState {
  /** The A operand at the PE's west input during this step. */
  a: Operand;
  /** The B operand at its north input. */
  b: Operand;
  /** The product registered last step, added to the accumulator at the end of this one. */
  prod: Operand;
  /** The accumulator at the start of this step (INT32, wrapping). */
  acc: number;
}

export interface ComputeSnapshot {
  /** Compute step t: the registers as they are during step t, after t clock edges. */
  step: number;
  /** The feed registers on the west (A, one per row) and north (B, one per column) edges. */
  feedA: Operand[];
  feedB: Operand[];
  /** pe[i][j] for row i, column j. */
  pe: PeState[][];
}

const IDLE: Operand = { value: 0, k: -1 };

/** Wraps to INT32, as the accumulator's 32-bit adder does. */
function wrap32(x: number): number {
  return x | 0;
}

function checkOp(op: GemmOp): void {
  const { m, n, k, a, b } = op;
  const inRange = (x: number, lo: number, hi: number) => Number.isInteger(x) && x >= lo && x <= hi;
  if (!inRange(m, 1, ARR) || !inRange(n, 1, ARR) || !inRange(k, 1, 1024)) {
    throw new RangeError(`shape ${m} × ${n} × ${k} does not fit one ${ARR} × ${ARR} command`);
  }
  const int8 = (row: number[] | undefined) =>
    row !== undefined && row.length === k && row.every((x) => inRange(x, -128, 127));
  if (a.length !== m || !a.every(int8) || b.length !== n || !b.every(int8)) {
    throw new RangeError("A must be M × K and B N × K, with INT8 elements");
  }
}

function element(rows: number[][], r: number, k: number): number {
  return rows[r]?.[k] ?? 0;
}

/**
 * The feeder of one edge (npu_opbuf.sv): at step t, row (or column) i loads element
 * k = t - 2 - i into its feed register, or zero when k is outside 0..K-1 or i is not part of
 * the operation. The register drives the array edge during step t + 1, so A[i][k] enters row i
 * at step k + i + 3. The lane-RAM read and the word register in front of it are folded into
 * this timing: they decide when the byte is ready, which is all the array sees.
 */
function nextFeed(rows: number[][], used: number, kLen: number, t: number): Operand[] {
  return Array.from({ length: ARR }, (_, i) => {
    const k = t - 2 - i;
    return i < used && k >= 0 && k < kLen ? { value: element(rows, i, k), k } : IDLE;
  });
}

/**
 * Runs the compute phase of one command and returns every step's registers: K + M + N + 2
 * steps, plus the state after the last clock edge, which holds the finished tile. Without
 * ACC_KEEP the accumulators start a new sum in step 0 (`clr` replaces the old value instead of
 * zeroing it, so no product is lost).
 */
export function simulateCompute(op: GemmOp): ComputeSnapshot[] {
  checkOp(op);
  const steps = computeSteps(op);
  let feedA: Operand[] = Array.from({ length: ARR }, () => IDLE);
  let feedB: Operand[] = Array.from({ length: ARR }, () => IDLE);
  // a_out and b_out of each PE: what it passes east and south at the next step.
  let aReg: Operand[][] = Array.from({ length: ARR }, () =>
    Array.from({ length: ARR }, () => IDLE),
  );
  let bReg: Operand[][] = Array.from({ length: ARR }, () =>
    Array.from({ length: ARR }, () => IDLE),
  );
  let prod: Operand[][] = Array.from({ length: ARR }, () =>
    Array.from({ length: ARR }, () => IDLE),
  );
  let acc: number[][] = Array.from({ length: ARR }, () => Array.from({ length: ARR }, () => 0));

  const snapshots: ComputeSnapshot[] = [];
  for (let t = 0; t <= steps; t++) {
    const aIn = (i: number, j: number): Operand => (j === 0 ? feedA[i] : aReg[i]?.[j - 1]) ?? IDLE;
    const bIn = (i: number, j: number): Operand => (i === 0 ? feedB[j] : bReg[i - 1]?.[j]) ?? IDLE;
    const pe = Array.from({ length: ARR }, (_, i) =>
      Array.from({ length: ARR }, (_, j) => ({
        a: aIn(i, j),
        b: bIn(i, j),
        prod: prod[i]?.[j] ?? IDLE,
        acc: acc[i]?.[j] ?? 0,
      })),
    );
    snapshots.push({ step: t, feedA, feedB, pe });
    if (t === steps) break;

    // The clock edge at the end of step t.
    const clr = t === 0;
    acc = pe.map((row) => row.map((p) => wrap32((clr ? 0 : p.acc) + p.prod.value)));
    prod = pe.map((row) =>
      row.map((p) => ({
        value: p.a.value * p.b.value,
        k: p.a.k >= 0 && p.a.k === p.b.k ? p.a.k : -1,
      })),
    );
    aReg = pe.map((row) => row.map((p) => p.a));
    bReg = pe.map((row) => row.map((p) => p.b));
    feedA = nextFeed(op.a, op.m, op.k, t);
    feedB = nextFeed(op.b, op.n, op.k, t);
  }
  return snapshots;
}

/** Compute phase length: the last pair reaches PE (M-1, N-1) at step K+M+N and is summed a step later. */
export function computeSteps({ m, n, k }: Pick<GemmOp, "m" | "n" | "k">): number {
  return k + m + n + 2;
}

/** The step during which PE (i, j)'s last product is added: its sum is final from the next one. */
export function finishStep(i: number, j: number, k: number): number {
  return k + i + j + 3;
}

/** C = A × Bᵀ the plain way, with the hardware's INT32 wrap-around. */
export function referenceProduct(op: GemmOp): number[][] {
  return op.a.map((aRow) =>
    op.b.map((bRow) => aRow.reduce((sum, x, k) => wrap32(sum + x * (bRow[k] ?? 0)), 0)),
  );
}

export interface CommandOptions {
  dmaBytes?: number;
  /** A_KEEP / B_KEEP hits: the operand is already in its buffer and is not loaded. */
  aKept?: boolean;
  bKept?: boolean;
  /** A bias vector at a 16-byte-aligned address (INT8 or INT32 output with bias). */
  bias?: boolean;
  /** NO_WB: keep the sums in the array for the next K chunk. */
  noWriteBack?: boolean;
}

export interface CommandTiming {
  load: number;
  compute: number;
  writeBack: number;
  total: number;
}

/**
 * The CYCLES register for one command whose rows start on block boundaries, the formula of
 * docs/npu.md section 6, which the cocotb testbench asserts for every operation it runs.
 */
export function commandTiming(
  shape: Pick<GemmOp, "m" | "n" | "k">,
  options: CommandOptions = {},
): CommandTiming {
  const { dmaBytes = DMA_BYTES, aKept = false, bKept = false, bias = false } = options;
  const blocksPerRow = Math.ceil(shape.k / dmaBytes);
  const rows = (aKept ? 0 : shape.m) + (bKept ? 0 : shape.n);
  const biasBlocks = bias && !options.noWriteBack ? Math.ceil((4 * shape.n) / dmaBytes) : 0;
  // One block per cycle, plus one cycle for the last block's data to land.
  const load = rows * blocksPerRow + biasBlocks + 1;
  const compute = computeSteps(shape);
  const writeBack = options.noWriteBack ? 0 : shape.m * shape.n + WB_LATENCY;
  return { load, compute, writeBack, total: load + compute + writeBack };
}

/** One DMA read of the load phase: an aligned block of a row of A or B. */
export interface DmaRead {
  operand: "A" | "B";
  row: number;
  block: number;
}

/** The load phase's reads in issue order, one per cycle: every block of A's rows, then B's. */
export function dmaSchedule(shape: Pick<GemmOp, "m" | "n" | "k">, dmaBytes = DMA_BYTES): DmaRead[] {
  const blocks = Math.ceil(shape.k / dmaBytes);
  const reads: DmaRead[] = [];
  for (const [operand, rows] of [
    ["A", shape.m],
    ["B", shape.n],
  ] as const) {
    for (let row = 0; row < rows; row++) {
      for (let block = 0; block < blocks; block++) reads.push({ operand, row, block });
    }
  }
  return reads;
}

export type Phase = "load" | "compute" | "writeBack" | "done";

export interface CommandCycle {
  phase: Phase;
  /** Cycles since START: the value CYCLES reads at this point. */
  cycle: number;
  /** Cycle within the current phase (0 when done). */
  inPhase: number;
}

/** Where cycle c of a command falls: LOAD, then COMPUTE, then write-back, then DONE. */
export function locateCycle(timing: CommandTiming, cycle: number): CommandCycle {
  const c = Math.max(0, Math.min(cycle, timing.total));
  if (c < timing.load) return { phase: "load", cycle: c, inPhase: c };
  if (c < timing.load + timing.compute) {
    return { phase: "compute", cycle: c, inPhase: c - timing.load };
  }
  if (c < timing.total) {
    return { phase: "writeBack", cycle: c, inPhase: c - timing.load - timing.compute };
  }
  return { phase: "done", cycle: c, inPhase: 0 };
}

/**
 * How many elements of C are in DMEM after `wbCycles` cycles of write-back: element e
 * (row-major) is issued in cycle e and written at the end of cycle e + 6, so the last one lands
 * as the phase ends.
 */
export function elementsWritten(shape: Pick<GemmOp, "m" | "n">, wbCycles: number): number {
  return Math.max(0, Math.min(shape.m * shape.n, wbCycles - WB_LATENCY));
}

/** A small seeded generator (mulberry32), so the page shows the same operands on every load. */
export function seededInt8Matrix(
  rows: number,
  cols: number,
  seed: number,
  magnitude: number,
): number[][] {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let x = s;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.floor(next() * (2 * magnitude + 1)) - magnitude),
  );
}
