// A small model of Tessera's loop IR (TensorIR-style): loops around blocks whose iteration
// variables are bound to expressions of the loops. It covers what the matmul template produces,
// prints in the format of Tessera's `tir.script` (without the reads/writes/annotate lines, as
// docs/tir.md shows its snippets) and runs on plain arrays, so a schedule can be checked against
// the unscheduled function the way Tessera's own tests do.

export type Expr =
  | { kind: "var"; name: string }
  | { kind: "int"; value: number }
  | { kind: "float"; value: number }
  | { kind: "add" | "mul" | "floordiv" | "floormod"; a: Expr; b: Expr }
  | { kind: "max"; a: Expr; b: Expr }
  | { kind: "load"; buffer: string; indices: Expr[] };

export interface IterVar {
  name: string;
  kind: "spatial" | "reduce";
  extent: number;
  binding: Expr;
}

export interface Store {
  buffer: string;
  indices: Expr[];
  value: Expr;
}

export interface Block {
  kind: "block";
  name: string;
  iters: IterVar[];
  /** A reduction's initialization, run when every reduce variable is at its first value. */
  init?: Store;
  store: Store;
  /** Index of the trace step that created or last placed this block (-1: the lowering). */
  origin: number;
}

export type LoopKind = "serial" | "parallel" | "vectorized" | "unrolled";

export interface Loop {
  kind: "loop";
  var: string;
  extent: number;
  loopKind: LoopKind;
  body: Stmt[];
  origin: number;
}

export type Stmt = Loop | Block;

export interface Buffer {
  name: string;
  shape: number[];
  /** Function parameters and plain allocations are global; cache buffers are local. */
  scope: "global" | "local";
}

export interface PrimFunc {
  name: string;
  params: Buffer[];
  allocs: Buffer[];
  body: Stmt[];
}

export const v = (name: string): Expr => ({ kind: "var", name });
export const int = (value: number): Expr => ({ kind: "int", value });
export const add = (a: Expr, b: Expr): Expr => ({ kind: "add", a, b });
export const mul = (a: Expr, b: Expr): Expr => ({ kind: "mul", a, b });
export const floordiv = (a: Expr, b: Expr): Expr => ({ kind: "floordiv", a, b });
export const floormod = (a: Expr, b: Expr): Expr => ({ kind: "floormod", a, b });
export const load = (buffer: string, ...indices: Expr[]): Expr => ({
  kind: "load",
  buffer,
  indices,
});

// ---------------------------------------------------------------------------------------------
// Printing
// ---------------------------------------------------------------------------------------------

const PRECEDENCE = { add: 1, mul: 2, floordiv: 2, floormod: 2 } as const;
const OPERATOR = { add: "+", mul: "*", floordiv: "//", floormod: "%" } as const;

export function printExpr(e: Expr): string {
  switch (e.kind) {
    case "var":
      return e.name;
    case "int":
      return String(e.value);
    case "float":
      return Number.isInteger(e.value) ? `${e.value}.0` : String(e.value);
    case "max":
      return `max(${printExpr(e.a)}, ${printExpr(e.b)})`;
    case "load":
      return `${e.buffer}[${e.indices.map(printExpr).join(", ")}]`;
    default: {
      const p = PRECEDENCE[e.kind];
      return `${operand(e.a, p, false)} ${OPERATOR[e.kind]} ${operand(e.b, p, true)}`;
    }
  }
}

// Operators are left-associative: a right operand of equal precedence needs parentheses.
function operand(e: Expr, parent: number, right: boolean): string {
  const text = printExpr(e);
  if (e.kind === "add" || e.kind === "mul" || e.kind === "floordiv" || e.kind === "floormod") {
    const p = PRECEDENCE[e.kind];
    if (p < parent || (right && p === parent)) return `(${text})`;
  }
  return text;
}

function bufferType(b: Buffer): string {
  return `float32[${b.shape.join(", ")}]`;
}

const LOOP_HEAD: Record<LoopKind, string> = {
  serial: "range",
  parallel: "parallel",
  vectorized: "vectorized",
  unrolled: "unrolled",
};

/** One printed line, with the trace step that produced the statement it belongs to. */
export interface Line {
  text: string;
  depth: number;
  origin: number;
}

export function printLines(func: PrimFunc): Line[] {
  const lines: Line[] = [
    { text: "@prim_func", depth: 0, origin: -1 },
    {
      text: `def ${func.name}(${func.params.map((p) => `${p.name}: ${bufferType(p)}`).join(", ")}):`,
      depth: 0,
      origin: -1,
    },
  ];
  for (const a of func.allocs) {
    const scope = a.scope === "local" ? ", 'local'" : "";
    lines.push({
      text: `${a.name} = alloc_buffer(${bufferType(a)}${scope})`,
      depth: 1,
      origin: -1,
    });
  }
  const stmt = (s: Stmt, depth: number) => {
    if (s.kind === "loop") {
      lines.push({
        text: `for ${s.var} in ${LOOP_HEAD[s.loopKind]}(${s.extent}):`,
        depth,
        origin: s.origin,
      });
      for (const c of s.body) stmt(c, depth + 1);
      return;
    }
    const at = (text: string, d: number) => lines.push({ text, depth: d, origin: s.origin });
    at(`with block('${s.name}'):`, depth);
    for (const iv of s.iters) {
      at(`${iv.name} = ${iv.kind}(${iv.extent}, ${printExpr(iv.binding)})`, depth + 1);
    }
    if (s.init) {
      at("with init():", depth + 1);
      at(storeText(s.init), depth + 2);
    }
    at(storeText(s.store), depth + 1);
  };
  for (const s of func.body) stmt(s, 1);
  return lines;
}

function storeText(s: Store): string {
  return `${s.buffer}[${s.indices.map(printExpr).join(", ")}] = ${printExpr(s.value)}`;
}

export function script(func: PrimFunc): string {
  return printLines(func)
    .map((l) => "    ".repeat(l.depth) + l.text)
    .join("\n");
}

// ---------------------------------------------------------------------------------------------
// Interpreting
// ---------------------------------------------------------------------------------------------

/** Row-major storage for every buffer the function touches, by name. */
export type Arrays = Record<string, Float64Array>;

/** Called for every block execution, with the values of its iteration variables. */
export type Visit = (block: Block, iters: ReadonlyMap<string, number>) => void;

/**
 * Run `func` in place on `arrays` (parameters and allocations alike; allocations should start
 * as NaN so that reading an element nothing wrote shows up, as in Tessera's interpreter).
 */
export function interpret(func: PrimFunc, arrays: Arrays, visit?: Visit): void {
  const shapes = new Map<string, number[]>();
  for (const b of [...func.params, ...func.allocs]) shapes.set(b.name, b.shape);

  const array = (name: string): Float64Array => {
    const a = arrays[name];
    if (!a) throw new Error(`no storage for buffer ${name}`);
    return a;
  };

  const offset = (buffer: string, indices: Expr[], scope: Map<string, number>): number => {
    const shape = shapes.get(buffer);
    if (!shape) throw new Error(`unknown buffer ${buffer}`);
    let at = 0;
    indices.forEach((ix, d) => {
      const i = evaluate(ix, scope);
      const extent = shape[d] ?? 0;
      if (!Number.isInteger(i) || i < 0 || i >= extent) {
        throw new Error(`${buffer} index ${i} out of bounds on axis ${d}`);
      }
      at = at * extent + i;
    });
    return at;
  };

  const evaluate = (e: Expr, scope: Map<string, number>): number => {
    switch (e.kind) {
      case "var": {
        const value = scope.get(e.name);
        if (value === undefined) throw new Error(`unbound variable ${e.name}`);
        return value;
      }
      case "int":
      case "float":
        return e.value;
      case "add":
        return evaluate(e.a, scope) + evaluate(e.b, scope);
      case "mul":
        return evaluate(e.a, scope) * evaluate(e.b, scope);
      case "floordiv":
        return Math.floor(evaluate(e.a, scope) / evaluate(e.b, scope));
      case "floormod": {
        const b = evaluate(e.b, scope);
        return ((evaluate(e.a, scope) % b) + b) % b;
      }
      case "max":
        return Math.max(evaluate(e.a, scope), evaluate(e.b, scope));
      case "load":
        return array(e.buffer)[offset(e.buffer, e.indices, scope)] as number;
    }
  };

  const write = (s: Store, scope: Map<string, number>) => {
    array(s.buffer)[offset(s.buffer, s.indices, scope)] = evaluate(s.value, scope);
  };

  const loops = new Map<string, number>();
  const run = (s: Stmt) => {
    if (s.kind === "loop") {
      for (let i = 0; i < s.extent; i++) {
        loops.set(s.var, i);
        for (const c of s.body) run(c);
      }
      loops.delete(s.var);
      return;
    }
    // Block bodies refer only to their own iteration variables (docs/tir.md, "Blocks are
    // isolated"), so they are evaluated in a scope of those alone.
    const iters = new Map<string, number>();
    for (const iv of s.iters) {
      const value = evaluate(iv.binding, loops);
      if (value < 0 || value >= iv.extent) {
        throw new Error(`${s.name}: ${iv.name} = ${value} outside [0, ${iv.extent})`);
      }
      iters.set(iv.name, value);
    }
    if (s.init && s.iters.every((iv) => iv.kind === "spatial" || iters.get(iv.name) === 0)) {
      write(s.init, iters);
    }
    write(s.store, iters);
    visit?.(s, iters);
  };

  for (const s of func.body) run(s);
}
