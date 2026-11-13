// Tessera's CPU matmul template on its generated-loops path (`c:generic`), for the group
// relu(A @ W + b): src/tessera/backend/c/templates/matmul.py, `schedule_matmul` and
// `tile_loops`. Given the template's five knobs it returns the trace of schedule primitives the
// template applies and the loop IR they produce. The unit tests compare both, as text, with what
// Tessera itself prints for every point of the knob space (data/matmul-schedules.json).

import {
  add,
  floordiv,
  floormod,
  int,
  load,
  mul,
  v,
  type Block,
  type Expr,
  type Loop,
  type LoopKind,
  type PrimFunc,
  type Stmt,
} from "./ir";

export interface MatmulShape {
  m: number;
  n: number;
  k: number;
}

/** The kernel docs/cpu.md uses to show the generated C: x is 64 x 256 and w is 256 x 128. */
export const DOC_KERNEL: MatmulShape = { m: 64, n: 128, k: 256 };

export type Order = "nm" | "mn";

export interface MatmulConfig {
  tile_m: number;
  tile_n: number;
  order: Order;
  pack_b: boolean;
  parallel: boolean;
}

export type Knob = keyof MatmulConfig;

/** Local copies are made only when they fit the stack (`PACK_LIMIT`, 64 KiB). */
export const PACK_LIMIT = 64 * 1024;
/** Outer loops run on the thread pool by default from this many multiply-adds. */
export const PARALLEL_WORK = 1 << 15;

const divisors = (n: number) =>
  Array.from({ length: n }, (_, i) => i + 1).filter((d) => n % d === 0);

function nearest(options: number[], want: number): number {
  return options.reduce((best, o) => {
    const d = Math.abs(o - want) - Math.abs(best - want);
    return d < 0 || (d === 0 && o > best) ? o : best;
  });
}

export interface KnobSpace {
  tile_m: number[];
  tile_n: number[];
  order: Order[];
  pack_b: boolean[];
  parallel: boolean[];
}

/** The knobs and their options, in the order the template asks for them. */
export function knobSpace(shape: MatmulShape): KnobSpace {
  const defaults = defaultConfig(shape);
  return {
    tile_m: divisors(shape.m).filter((d) => d <= 8),
    tile_n: divisors(shape.n).filter((d) => d <= 64),
    order: ["nm", "mn"],
    pack_b: [defaults.pack_b, !defaults.pack_b],
    parallel: [defaults.parallel, !defaults.parallel],
  };
}

export function defaultConfig(shape: MatmulShape): MatmulConfig {
  const rows = divisors(shape.m).filter((d) => d <= 8);
  const columns = divisors(shape.n).filter((d) => d <= 64);
  const preferred = columns.filter((d) => d % 4 === 0 && d <= 16);
  return {
    tile_m: nearest(rows, 4),
    tile_n: preferred.length > 0 ? Math.max(...preferred) : nearest(columns, 16),
    order: "nm",
    pack_b: true,
    parallel: shape.m * shape.n * shape.k >= PARALLEL_WORK,
  };
}

export interface Scheduled {
  trace: string[];
  func: PrimFunc;
  /** Whether the strip of W was copied into W_local (order nm, pack_b, and it fits). */
  packed: boolean;
  /** The loop that runs on the thread pool, if any. */
  parallelLoop: string | null;
}

/** `tile * factor + inner`, simplified as Tessera's simplifier prints it. */
function tiled(tile: Expr, factor: number, inner: Expr | null): Expr {
  const base = factor === 1 ? tile : mul(tile, int(factor));
  return inner ? add(base, inner) : base;
}

export function scheduleMatmul(shape: MatmulShape, cfg: MatmulConfig): Scheduled {
  const { m: M, n: N, k: K } = shape;
  const tm = cfg.tile_m;
  const tn = cfg.tile_n;
  if (M % tm !== 0 || N % tn !== 0) throw new Error("tiles must divide the extents");
  const rowTiles = M / tm;
  const colTiles = N / tn;
  const trace: string[] = [];
  const step = (line: string) => trace.push(line) - 1;

  step(`split(m, [None, ${tm}]) -> [m_0, m_1]`);
  step(`split(n, [None, ${tn}]) -> [n_0, n_1]`);
  const reorder =
    cfg.order === "nm"
      ? step("reorder([n_0, m_0, k, m_1, n_1])")
      : step("reorder([m_0, n_0, k, m_1, n_1])");
  const cacheWrite = step("cache_write('matmul', 0, 'local') -> 'matmul_local'");
  const tileLoop = cfg.order === "nm" ? "m_0" : "n_0";
  const placeCopy = step(`reverse_compute_at('matmul_local', ${tileLoop})`);
  const decompose = step("decompose_reduction('matmul', k) -> 'matmul_init'");
  const inlineEpilogue = step("reverse_compute_inline('relu')");
  const unroll = step("unroll(m_1)");
  const vectorize = step("vectorize(n_1)");
  // The copy-out nest keeps only its loops of more than one iteration; its innermost is vectorized.
  const copyInner = tn > 1 ? "ax1" : tm > 1 ? "ax0" : null;
  const vectorizeCopy = copyInner ? step(`vectorize(${copyInner})`) : -1;

  const strip = K * tn * 4;
  const packed = cfg.order === "nm" && cfg.pack_b && strip <= PACK_LIMIT;
  let cacheRead = -1;
  let computeAt = -1;
  if (packed) {
    cacheRead = step("cache_read('matmul', 1, 'local') -> 'W_local'");
    computeAt = step("compute_at('W_local', n_0)");
  }
  let fuse = -1;
  let outerVar: string;
  let outerExtent: number;
  if (cfg.order === "nm") {
    outerVar = "n_0";
    outerExtent = colTiles;
  } else {
    fuse = step("fuse([m_0, n_0]) -> m_0_n_0_fused");
    outerVar = "m_0_n_0_fused";
    outerExtent = rowTiles * colTiles;
  }
  const parallel = cfg.parallel && outerExtent > 1;
  const parallelStep = parallel ? step(`parallel(${outerVar})`) : -1;

  // The row and column tile of the current iteration, as the bindings read them.
  const outer = v(outerVar);
  const rowTile = cfg.order === "nm" ? v("m_0") : floordiv(outer, int(colTiles));
  const colTile = cfg.order === "nm" ? outer : floormod(outer, int(colTiles));

  const init: Block = {
    kind: "block",
    name: "matmul_init",
    iters: [
      { name: "v_m_1", kind: "spatial", extent: M, binding: tiled(rowTile, tm, v("m_1_init")) },
      { name: "v_n_1", kind: "spatial", extent: N, binding: tiled(colTile, tn, v("n_1_init")) },
    ],
    store: {
      buffer: "matmul_local",
      indices: [v("v_m_1"), v("v_n_1")],
      value: { kind: "float", value: 0 },
    },
    origin: decompose,
  };
  const initNest = loop("m_1_init", tm, "serial", decompose, [
    loop("n_1_init", tn, "serial", decompose, [init]),
  ]);

  const wRead = packed ? "W_local" : "W";
  const main: Block = {
    kind: "block",
    name: "matmul",
    iters: [
      { name: "v_m", kind: "spatial", extent: M, binding: tiled(rowTile, tm, v("m_1")) },
      { name: "v_n", kind: "spatial", extent: N, binding: tiled(colTile, tn, v("n_1")) },
      { name: "v_k", kind: "reduce", extent: K, binding: v("k") },
    ],
    store: {
      buffer: "matmul_local",
      indices: [v("v_m"), v("v_n")],
      value: add(
        load("matmul_local", v("v_m"), v("v_n")),
        mul(load("A", v("v_m"), v("v_k")), load(wRead, v("v_k"), v("v_n"))),
      ),
    },
    origin: packed ? cacheRead : cacheWrite,
  };
  const mainNest = loop("k", K, "serial", reorder, [
    loop("m_1", tm, "unrolled", unroll, [loop("n_1", tn, "vectorized", vectorize, [main])]),
  ]);

  // The tile's write-back, with the ReLU epilogue inlined into it.
  const copy: Block = {
    kind: "block",
    name: "matmul_local",
    iters: [
      {
        name: "v0",
        kind: "spatial",
        extent: M,
        binding: tiled(rowTile, tm, tm > 1 ? v("ax0") : null),
      },
      {
        name: "v1",
        kind: "spatial",
        extent: N,
        binding: tiled(colTile, tn, tn > 1 ? v("ax1") : null),
      },
    ],
    store: {
      buffer: "relu",
      indices: [v("v0"), v("v1")],
      value: {
        kind: "max",
        a: add(load("matmul_local", v("v0"), v("v1")), load("b", v("v1"))),
        b: { kind: "float", value: 0 },
      },
    },
    origin: inlineEpilogue,
  };
  let copyNest: Stmt = copy;
  if (tn > 1) copyNest = loop("ax1", tn, "vectorized", vectorizeCopy, [copyNest]);
  if (tm > 1) {
    const kind = copyInner === "ax0" ? "vectorized" : "serial";
    copyNest = loop("ax0", tm, kind, copyInner === "ax0" ? vectorizeCopy : placeCopy, [copyNest]);
  }

  const tileBody: Stmt[] = [initNest, mainNest, copyNest];
  const outerKind: LoopKind = parallel ? "parallel" : "serial";
  const outerOrigin = parallel ? parallelStep : cfg.order === "nm" ? reorder : fuse;
  let body: Stmt[];
  if (cfg.order === "nm") {
    const perStrip: Stmt[] = [];
    if (packed) perStrip.push(packNest(shape, tn, tm > 1, computeAt));
    perStrip.push(loop("m_0", rowTiles, "serial", reorder, tileBody));
    body = [loop("n_0", colTiles, outerKind, outerOrigin, perStrip)];
  } else {
    body = [loop(outerVar, outerExtent, outerKind, outerOrigin, tileBody)];
  }

  const func: PrimFunc = {
    name: "matmul",
    params: [
      { name: "A", shape: [M, K], scope: "global" },
      { name: "W", shape: [K, N], scope: "global" },
      { name: "b", shape: [N], scope: "global" },
      { name: "relu", shape: [M, N], scope: "global" },
    ],
    allocs: [
      { name: "matmul_local", shape: [M, N], scope: "local" },
      ...(packed ? [{ name: "W_local", shape: [K, N], scope: "local" as const }] : []),
    ],
    body,
  };
  return { trace, func, packed, parallelLoop: parallel ? outerVar : null };
}

function loop(name: string, extent: number, kind: LoopKind, origin: number, body: Stmt[]): Loop {
  return { kind: "loop", var: name, extent, loopKind: kind, body, origin };
}

/**
 * The copy of one K x tile_n strip of W into W_local, placed under n_0 by compute_at. The
 * printer suffixes its loop and block variables when the copy-out nest already uses the name.
 */
function packNest(shape: MatmulShape, tn: number, rowLoopTaken: boolean, origin: number): Stmt {
  const row = rowLoopTaken ? "ax0_1" : "ax0";
  const col = "ax1_1";
  const block: Block = {
    kind: "block",
    name: "W_local",
    iters: [
      { name: "v0_1", kind: "spatial", extent: shape.k, binding: v(row) },
      {
        name: "v1_1",
        kind: "spatial",
        extent: shape.n,
        binding: tiled(v("n_0"), tn, tn > 1 ? v(col) : null),
      },
    ],
    store: {
      buffer: "W_local",
      indices: [v("v0_1"), v("v1_1")],
      value: load("W", v("v0_1"), v("v1_1")),
    },
    origin,
  };
  const inner = tn > 1 ? loop(col, tn, "serial", origin, [block]) : block;
  return loop(row, shape.k, "serial", origin, [inner]);
}

/** The function as `compute.lower_group` builds it, before any schedule. */
export function unscheduled(shape: MatmulShape): PrimFunc {
  const { m: M, n: N, k: K } = shape;
  const zero: Expr = { kind: "float", value: 0 };
  const main: Block = {
    kind: "block",
    name: "matmul",
    iters: [
      { name: "v_m", kind: "spatial", extent: M, binding: v("m") },
      { name: "v_n", kind: "spatial", extent: N, binding: v("n") },
      { name: "v_k", kind: "reduce", extent: K, binding: v("k") },
    ],
    init: { buffer: "matmul", indices: [v("v_m"), v("v_n")], value: zero },
    store: {
      buffer: "matmul",
      indices: [v("v_m"), v("v_n")],
      value: add(
        load("matmul", v("v_m"), v("v_n")),
        mul(load("A", v("v_m"), v("v_k")), load("W", v("v_k"), v("v_n"))),
      ),
    },
    origin: -1,
  };
  const relu: Block = {
    kind: "block",
    name: "relu",
    iters: [
      { name: "v_i0", kind: "spatial", extent: M, binding: v("i0") },
      { name: "v_i1", kind: "spatial", extent: N, binding: v("i1") },
    ],
    store: {
      buffer: "relu",
      indices: [v("v_i0"), v("v_i1")],
      value: {
        kind: "max",
        a: add(load("matmul", v("v_i0"), v("v_i1")), load("b", v("v_i1"))),
        b: zero,
      },
    },
    origin: -1,
  };
  return {
    name: "matmul",
    params: [
      { name: "A", shape: [M, K], scope: "global" },
      { name: "W", shape: [K, N], scope: "global" },
      { name: "b", shape: [N], scope: "global" },
      { name: "relu", shape: [M, N], scope: "global" },
    ],
    allocs: [{ name: "matmul", shape: [M, N], scope: "global" }],
    body: [
      loop("m", M, "serial", -1, [
        loop("n", N, "serial", -1, [loop("k", K, "serial", -1, [main])]),
      ]),
      loop("i0", M, "serial", -1, [loop("i1", N, "serial", -1, [relu])]),
    ],
  };
}
