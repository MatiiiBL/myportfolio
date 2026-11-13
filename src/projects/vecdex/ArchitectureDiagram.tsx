import "./diagrams.css";

// Byte counts of a SIFT1M index (n = 1M, dim = 128, M = 16), from the size formula in vecdex's
// docs/FORMAT.md with U ≈ n / (M − 1) upper-layer blocks.
const N = 1_000_000;
const M = 16;
const MB = 1e6;
const SECTIONS = [
  { label: "vectors", detail: "n × 128 floats, row-major", bytes: 4 * N * 128 },
  { label: "layer-0 links", detail: "[count | 2M ids] per node", bytes: 4 * N * (1 + 2 * M) },
  { label: "upper links", detail: "[count | M ids] per layer", bytes: (4 * N * (1 + M)) / (M - 1) },
];
const TOTAL = SECTIONS.reduce((sum, s) => sum + s.bytes, 0);

const W = 360;
const BAR_WIDTH = W - 32;
const SEGMENTS = SECTIONS.map((s, i) => {
  const before = SECTIONS.slice(0, i).reduce((sum, p) => sum + p.bytes, 0);
  return { x: 16 + (before / TOTAL) * BAR_WIDTH, width: (s.bytes / TOTAL) * BAR_WIDTH };
});

/** vecdex's layers, top (APIs) to bottom (storage), with the SIFT1M memory split to scale. */
export function ArchitectureDiagram() {
  return (
    <figure className="dg">
      <svg
        viewBox={`0 0 ${W} 452`}
        role="img"
        aria-labelledby="vx-arch-title vx-arch-desc"
        className="dg-svg"
      >
        <title id="vx-arch-title">vecdex architecture</title>
        <desc id="vx-arch-desc">
          Python and C++ callers share one HnswIndex. Searches run lock-free; a parallel add locks
          one node at a time. The index holds its vectors in one row-major buffer and its links in
          fixed-size blocks; on SIFT1M the vectors are about 79 percent of the 650 MB. Distances go
          through a scalar, NEON or AVX2 kernel chosen at run time, and save and load go through a
          checksummed, validated file format.
        </desc>
        <defs>
          <marker
            id="vx-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 z" className="dg-arrowhead" />
          </marker>
        </defs>

        <Box x={16} y={8} w={156} h={46} title="Python" sub="zero-copy NumPy input" />
        <Box x={188} y={8} w={156} h={46} title="C++" sub="vecdex::HnswIndex" />
        <line className="dg-link" x1={94} y1={54} x2={94} y2={78} markerEnd="url(#vx-arrow)" />
        <line className="dg-link" x1={266} y1={54} x2={266} y2={78} markerEnd="url(#vx-arrow)" />

        <rect className="dg-frame" x={8} y={82} width={W - 16} height={232} rx={10} />
        <text className="dg-kicker" x={20} y={102}>
          HNSWINDEX
        </text>
        <Box x={16} y={112} w={156} h={52} title="search()" sub="lock-free" />
        <Box x={188} y={112} w={156} h={52} title="add(threads)" sub="per-node locks" />

        <text className="dg-label" x={16} y={190}>
          Memory, SIFT1M (n = 1M, M = 16)
        </text>
        {SEGMENTS.map((seg, i) => (
          <rect
            key={seg.x}
            className={`dg-seg dg-seg-${i + 1}`}
            x={seg.x}
            y={198}
            width={Math.max(1, seg.width - 2)}
            height={18}
          />
        ))}
        {SECTIONS.map((s, i) => (
          <g key={`${s.label}-legend`} transform={`translate(16 ${236 + i * 22})`}>
            <rect className={`dg-seg dg-seg-${i + 1}`} width={10} height={10} y={-9} rx={2} />
            <text className="dg-text" x={16}>
              {s.label}
            </text>
            <text className="dg-sub" x={120}>
              {s.detail}
            </text>
            <text className="dg-num" x={BAR_WIDTH} textAnchor="end">
              {Math.round(s.bytes / MB)} MB
            </text>
          </g>
        ))}

        <line className="dg-link" x1={180} y1={314} x2={180} y2={334} markerEnd="url(#vx-arrow)" />
        <Box
          x={16}
          y={338}
          w={W - 32}
          h={46}
          title="distance kernels"
          sub="scalar · NEON · AVX2+FMA, picked at run time"
        />
        <line className="dg-link" x1={180} y1={384} x2={180} y2={398} markerEnd="url(#vx-arrow)" />
        <Box
          x={16}
          y={402}
          w={W - 32}
          h={46}
          title="save / load"
          sub="checksummed, durable save; validated load"
        />
      </svg>
    </figure>
  );
}

interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
}

export function Box({ x, y, w, h, title, sub }: BoxProps) {
  return (
    <g>
      <rect className="dg-box" x={x} y={y} width={w} height={h} rx={8} />
      <text className="dg-title" x={x + 12} y={y + 20}>
        {title}
      </text>
      <text className="dg-sub" x={x + 12} y={y + 37}>
        {sub}
      </text>
    </g>
  );
}
