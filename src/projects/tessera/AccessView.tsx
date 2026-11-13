import { useRef } from "react";
import { useWidth } from "../../components/charts/useWidth";
import type { MatmulConfig, MatmulShape } from "./schedule/matmul";
import type { TileStep } from "./schedule/tiles";

interface AccessViewProps {
  shape: MatmulShape;
  cfg: MatmulConfig;
  steps: TileStep[];
  index: number;
  packed: boolean;
}

const PAD = 4;
const GAP = 10;
const LABEL = 18;

/**
 * C = A x W drawn to scale, W above C and A to its left, with what the current step of the tile
 * loop touches: its register tile of C, the rows of A and the strip of W it reads (from W_local
 * when the strip is packed), and the tiles already finished.
 */
export function AccessView({ shape, cfg, steps, index, packed }: AccessViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const width = Math.min(useWidth(ref, 440), 560);
  const { m: M, n: N, k: K } = shape;
  const s = (width - 2 * PAD - GAP) / (K + N);
  const w = { x: PAD + K * s + GAP, y: LABEL, width: N * s, height: K * s };
  const a = { x: PAD, y: w.y + w.height + GAP, width: K * s, height: M * s };
  const c = { x: w.x, y: a.y, width: N * s, height: M * s };
  const height = a.y + a.height + LABEL + 4;
  const step = steps[index] ?? steps[0];
  if (!step) return null;
  const tm = cfg.tile_m * s;
  const tn = cfg.tile_n * s;
  const rows = M / cfg.tile_m;
  const cols = N / cfg.tile_n;

  // Finished tiles, as at most two rectangles: whole column strips (or row bands) before the
  // current one, then the part of the current one already done.
  const done =
    cfg.order === "nm"
      ? [
          { x: c.x, y: c.y, width: step.col * tn, height: c.height },
          { x: c.x + step.col * tn, y: c.y, width: tn, height: step.row * tm },
        ]
      : [
          { x: c.x, y: c.y, width: c.width, height: step.row * tm },
          { x: c.x, y: c.y + step.row * tm, width: step.col * tn, height: tm },
        ];

  const strip = { x: w.x + step.col * tn, y: w.y, width: tn, height: w.height };
  const local = { x: w.x - GAP - Math.max(tn, 3), y: w.y, width: Math.max(tn, 3), height: K * s };
  const grid = (count: number, along: "x" | "y", box: typeof c, size: number) =>
    size >= 4
      ? Array.from({ length: count - 1 }, (_, i) =>
          along === "x" ? (
            <line
              key={`${along}${i}`}
              x1={box.x + (i + 1) * size}
              x2={box.x + (i + 1) * size}
              y1={box.y}
              y2={box.y + box.height}
            />
          ) : (
            <line
              key={`${along}${i}`}
              x1={box.x}
              x2={box.x + box.width}
              y1={box.y + (i + 1) * size}
              y2={box.y + (i + 1) * size}
            />
          ),
        )
      : null;

  return (
    <div ref={ref} className="access-view">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMinYMin meet"
        aria-hidden="true"
        focusable="false"
      >
        <g className="access-matrix">
          <rect {...w} />
          <rect {...a} />
          <rect {...c} />
        </g>
        <g className="access-grid">
          {grid(cols, "x", c, tn)}
          {grid(rows, "y", c, tm)}
        </g>
        {done.map((r, i) => (
          <rect key={i} className="access-done" {...r} />
        ))}
        <rect className="access-read" x={a.x} y={a.y + step.row * tm} width={a.width} height={tm} />
        <rect
          className={
            packed ? (step.packs ? "access-source is-copying" : "access-source") : "access-read"
          }
          {...strip}
        />
        {packed && (
          <>
            <rect className="access-read" {...local} />
            <text className="access-label" x={local.x + local.width} y={w.y - 6} textAnchor="end">
              W_local
            </text>
          </>
        )}
        <rect
          className="access-tile"
          x={c.x + step.col * tn}
          y={c.y + step.row * tm}
          width={tn}
          height={tm}
        />
        <text className="access-label" x={w.x} y={w.y - 6}>
          W {K}×{N}
        </text>
        <text className="access-label" x={a.x} y={a.y + a.height + 14}>
          A {M}×{K}
        </text>
        <text className="access-label" x={c.x} y={c.y + c.height + 14}>
          relu {M}×{N}
        </text>
      </svg>
    </div>
  );
}
