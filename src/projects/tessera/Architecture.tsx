import { useRef } from "react";
import { useWidth } from "../../components/charts/useWidth";
import { Figure } from "../../components/Figure";
import "./Architecture.css";

interface Node {
  id: string;
  title: string;
  lines: string[];
  /** Shorter lines for the narrow layout's side column. */
  narrowLines?: string[];
  emphasis?: boolean;
}

const NODES: Node[] = [
  { id: "onnx", title: "ONNX model", lines: ["static shapes"] },
  { id: "import", title: "Import", lines: ["82 ONNX operators", "onto 50 of its own"] },
  { id: "graph", title: "Graph passes", lines: ["fold BatchNorm, find", "LayerNorm, GELU; NHWC"] },
  { id: "fuse", title: "Fuse, plan memory", lines: ["prologue, anchor,", "epilogue; one arena"] },
  { id: "lower", title: "Lower each group", lines: ["a loop IR of blocks", "(TensorIR-style)"] },
  {
    id: "schedule",
    title: "Schedule",
    lines: ["template + config:", "split, tensorize, ..."],
    emphasis: true,
  },
  {
    id: "tune",
    title: "Autotuner",
    lines: ["cost model, search,", "validated logs"],
    narrowLines: ["cost model,", "search, logs"],
  },
  { id: "c", title: "C backend", lines: ["NEON, SME micro-", "kernels, thread pool"] },
  { id: "metal", title: "Metal backend", lines: ["MSL, SIMD-group", "matrix tiles"] },
];

interface Box {
  x: number;
  y: number;
  w: number;
}

interface Layout {
  width: number;
  height: number;
  boxes: Record<string, Box>;
  edges: { from: string; to: string; path: string; dashed?: boolean }[];
  narrow: boolean;
}

const H = 64;

function wide(): Layout {
  const boxes: Record<string, Box> = {
    onnx: { x: 0, y: 8, w: 112 },
    import: { x: 140, y: 8, w: 176 },
    graph: { x: 344, y: 8, w: 176 },
    fuse: { x: 548, y: 8, w: 172 },
    lower: { x: 548, y: 120, w: 172 },
    schedule: { x: 344, y: 120, w: 176 },
    tune: { x: 140, y: 120, w: 176 },
    c: { x: 248, y: 232, w: 176 },
    metal: { x: 452, y: 232, w: 176 },
  };
  const mid = (b: Box) => b.x + b.w / 2;
  const s = boxes.schedule as Box;
  const edges = [
    { from: "onnx", to: "import", path: `M112 40 H136` },
    { from: "import", to: "graph", path: `M316 40 H340` },
    { from: "graph", to: "fuse", path: `M520 40 H544` },
    { from: "fuse", to: "lower", path: `M634 72 V116` },
    { from: "lower", to: "schedule", path: `M548 152 H524` },
    { from: "tune", to: "schedule", path: `M316 152 H340`, dashed: true },
    {
      from: "schedule",
      to: "c",
      path: `M${mid(s)} 184 V206 H${mid(boxes.c as Box)} V228`,
    },
    {
      from: "schedule",
      to: "metal",
      path: `M${mid(s)} 184 V206 H${mid(boxes.metal as Box)} V228`,
    },
  ];
  return { width: 720, height: 300, boxes, edges, narrow: false };
}

function narrow(): Layout {
  const main = 206;
  const gap = 28;
  const row = (i: number) => 8 + i * (H + gap);
  const boxes: Record<string, Box> = {
    onnx: { x: 0, y: row(0), w: main },
    import: { x: 0, y: row(1), w: main },
    graph: { x: 0, y: row(2), w: main },
    fuse: { x: 0, y: row(3), w: main },
    lower: { x: 0, y: row(4), w: main },
    schedule: { x: 0, y: row(5), w: main },
    tune: { x: main + 26, y: row(5), w: 360 - main - 26 },
    c: { x: 0, y: row(6) + 8, w: 172 },
    metal: { x: 188, y: row(6) + 8, w: 172 },
  };
  const down = (i: number) => `M${main / 2} ${row(i) + H} V${row(i + 1) - 4}`;
  const sy = row(5) + H;
  const edges = [
    { from: "onnx", to: "import", path: down(0) },
    { from: "import", to: "graph", path: down(1) },
    { from: "graph", to: "fuse", path: down(2) },
    { from: "fuse", to: "lower", path: down(3) },
    { from: "lower", to: "schedule", path: down(4) },
    {
      from: "tune",
      to: "schedule",
      path: `M${main + 26} ${row(5) + H / 2} H${main + 4}`,
      dashed: true,
    },
    { from: "schedule", to: "c", path: `M${main / 2} ${sy} V${sy + 14} H86 V${row(6) + 4}` },
    { from: "schedule", to: "metal", path: `M${main / 2} ${sy} V${sy + 14} H274 V${row(6) + 4}` },
  ];
  return { width: 360, height: row(6) + 8 + H + 4, boxes, edges, narrow: true };
}

export function Architecture() {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref, 720);
  const layout = width >= 600 ? wide() : narrow();
  return (
    <Figure
      title="From an ONNX model to native code"
      subtitle="the compiler's stages · dashed: tuned configurations"
      caption={
        <>
          Each fused group becomes one kernel. A template schedules its loop IR with the
          configuration the tuning logs hold for its task, or the template&apos;s defaults, and a
          backend prints the result as C or as Metal Shading Language. Source: the README and{" "}
          <a href="https://github.com/MatiiiBL/tessera/blob/main/docs/design.md">docs/design.md</a>.
        </>
      }
    >
      <div ref={ref} className="arch">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width="100%"
          role="img"
          aria-label="Tessera's pipeline: an ONNX model is imported, optimized by graph passes, fused into groups with a memory plan, each group is lowered to a loop IR and scheduled by a template with a configuration from the autotuner, then compiled by the C backend with NEON and SME microkernels or by the Metal backend."
          style={{ maxWidth: layout.width }}
        >
          <defs>
            <marker
              id="arch-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L8 4 L0 8 z" className="arch-arrowhead" />
            </marker>
          </defs>
          {layout.edges.map((e) => (
            <path
              key={`${e.from}-${e.to}`}
              d={e.path}
              className={e.dashed ? "arch-edge is-dashed" : "arch-edge"}
              markerEnd="url(#arch-arrow)"
            />
          ))}
          {NODES.map((n) => {
            const b = layout.boxes[n.id];
            if (!b) return null;
            const lines = layout.narrow && n.narrowLines ? n.narrowLines : n.lines;
            return (
              <g key={n.id} className={n.emphasis ? "arch-node is-emphasis" : "arch-node"}>
                <rect x={b.x + 0.5} y={b.y + 0.5} width={b.w - 1} height={H - 1} rx={8} />
                <text className="arch-title" x={b.x + 12} y={b.y + 21}>
                  {n.title}
                </text>
                {lines.map((line, i) => (
                  <text key={line} className="arch-detail" x={b.x + 12} y={b.y + 38 + i * 14}>
                    {line}
                  </text>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
    </Figure>
  );
}
