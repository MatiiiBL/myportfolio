import { Arrow, Block, BlockDiagram, Label } from "../../components/BlockDiagram";

// Byte counts of a SIFT1M index (n = 1M, dim = 128, M = 16), from the size formula in vecdex's
// docs/FORMAT.md with U ≈ n / (M − 1) upper-layer blocks.
const N = 1_000_000;
const M = 16;
const MB = 1e6;
const SECTIONS = [
  {
    label: "vectors",
    detail: "n × 128 floats, row-major",
    bytes: 4 * N * 128,
    color: "var(--series-1)",
  },
  {
    label: "layer-0 links",
    detail: "[count | 2M ids] per node",
    bytes: 4 * N * (1 + 2 * M),
    color: "var(--series-2)",
  },
  {
    label: "upper links",
    detail: "[count | M ids] per layer",
    bytes: (4 * N * (1 + M)) / (M - 1),
    color: "var(--series-3)",
  },
];
const TOTAL = SECTIONS.reduce((sum, s) => sum + s.bytes, 0);
const BAR_LEFT = 14;
const BAR_WIDTH = 372;
const SEGMENTS = SECTIONS.map((s, i) => {
  const before = SECTIONS.slice(0, i).reduce((sum, p) => sum + p.bytes, 0);
  return {
    ...s,
    x: BAR_LEFT + (before / TOTAL) * BAR_WIDTH,
    width: (s.bytes / TOTAL) * BAR_WIDTH,
  };
});

/** vecdex's layers, top (APIs) to bottom (storage), with the SIFT1M memory split to scale. */
export function ArchitectureDiagram() {
  return (
    <BlockDiagram
      height={414}
      title="vecdex architecture"
      description={
        "Python and C++ callers share one HnswIndex. Searches run lock-free; a parallel add " +
        "locks one node at a time. The index keeps its vectors in one row-major buffer and its " +
        "links in fixed-size blocks: on SIFT1M the vectors take 512 MB, the layer-0 links " +
        "132 MB and the upper-layer links about 5 MB. Distances go through a scalar, NEON or " +
        "AVX2 kernel chosen at run time, and save and load go through a checksummed, " +
        "validated file format."
      }
    >
      <Block x={0} y={0} w={190} h={52} title="Python" sub="zero-copy NumPy input" />
      <Block x={210} y={0} w={190} h={52} title="C++" sub="vecdex::HnswIndex" />
      <Arrow
        points={[
          [95, 52],
          [95, 80],
        ]}
      />
      <Arrow
        points={[
          [305, 52],
          [305, 80],
        ]}
      />

      <Block x={0} y={82} w={400} h={244} title="HnswIndex" group />
      <Block x={14} y={114} w={178} h={52} title="search()" sub="lock-free" />
      <Block x={208} y={114} w={178} h={52} title="add(threads)" sub="per-node locks" />
      <Label at={[BAR_LEFT, 196]} text="memory, SIFT1M (n = 1M, M = 16)" />
      {SEGMENTS.map((s) => (
        <rect
          key={s.label}
          x={s.x}
          y={206}
          width={Math.max(1, s.width - 2)}
          height={18}
          rx={2}
          style={{ fill: s.color }}
        />
      ))}
      {SEGMENTS.map((s, i) => (
        <g key={`${s.label}-key`}>
          <rect
            x={BAR_LEFT}
            y={246 + i * 24}
            width={10}
            height={10}
            rx={2}
            style={{ fill: s.color }}
          />
          <Label at={[BAR_LEFT + 16, 255 + i * 24]} text={s.label} />
          <Label at={[132, 255 + i * 24]} text={s.detail} />
          <Label
            at={[BAR_LEFT + BAR_WIDTH, 255 + i * 24]}
            anchor="end"
            text={`${Math.round(s.bytes / MB)} MB`}
          />
        </g>
      ))}

      <Arrow
        points={[
          [95, 326],
          [95, 358],
        ]}
      />
      <Arrow
        points={[
          [305, 326],
          [305, 358],
        ]}
      />
      <Block x={0} y={360} w={190} h={52} title="distance kernels" sub="scalar · NEON · AVX2" />
      <Block x={210} y={360} w={190} h={52} title="save / load" sub="checksummed, validated" />
    </BlockDiagram>
  );
}
