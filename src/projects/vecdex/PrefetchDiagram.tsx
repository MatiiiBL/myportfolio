import { Arrow, BlockDiagram, Label } from "../../components/BlockDiagram";

// A schematic of one node expansion with four unvisited neighbors: the timings are illustrative
// (a miss drawn as several times a distance computation), not measured.
const MISS = 58;
const WORK = 16;
const ISSUE = 6;
const NEIGHBORS = 4;
const X0 = 14;
const MISS_FILL = { fill: "var(--series-2)" };
const WORK_FILL = { fill: "var(--series-1)" };

function serial() {
  return Array.from({ length: NEIGHBORS }, (_, i) => ({
    miss: X0 + i * (MISS + WORK),
    work: X0 + i * (MISS + WORK) + MISS,
  }));
}

function prefetched() {
  let free = 0;
  return Array.from({ length: NEIGHBORS }, (_, i) => {
    const missStart = X0 + i * ISSUE;
    const work = Math.max(missStart + MISS, free);
    free = work + WORK;
    return { miss: missStart, work };
  });
}

/** Why prefetching doubled search speed: the cache misses of one expansion overlap. */
export function PrefetchDiagram() {
  const a = serial();
  const b = prefetched();
  return (
    <BlockDiagram
      height={236}
      title="One expansion, without and with prefetching"
      description={
        "Without prefetching, each neighbor's distance waits for its own cache miss, so four " +
        "misses happen one after another. With prefetching, all four loads are requested " +
        "first and their misses overlap, so the four distances finish after roughly one miss. " +
        "The timings are schematic."
      }
    >
      <Label at={[X0, 14]} text="before: load, compute, load, compute" />
      {a.map((s, i) => (
        <g key={`a-${i}`}>
          <rect x={s.miss} y={24} width={MISS - 2} height={18} rx={2} style={MISS_FILL} />
          <rect x={s.work} y={24} width={WORK - 2} height={18} rx={2} style={WORK_FILL} />
        </g>
      ))}

      <Label at={[X0, 80]} text="prefetch: request every load, then compute" />
      {b.map((s, i) => (
        <rect
          key={`b-miss-${i}`}
          x={s.miss}
          y={90 + i * 10}
          width={MISS - 2}
          height={8}
          rx={2}
          style={MISS_FILL}
        />
      ))}
      {b.map((s, i) => (
        <rect
          key={`b-work-${i}`}
          x={s.work}
          y={130}
          width={WORK - 2}
          height={18}
          rx={2}
          style={WORK_FILL}
        />
      ))}

      <Arrow
        points={[
          [X0, 172],
          [386, 172],
        ]}
      />
      <Label at={[386, 190]} anchor="end" text="time (schematic)" />
      <rect x={X0} y={214} width={10} height={10} rx={2} style={MISS_FILL} />
      <Label at={[X0 + 16, 223]} text="waiting on a cache miss" />
      <rect x={214} y={214} width={10} height={10} rx={2} style={WORK_FILL} />
      <Label at={[230, 223]} text="computing a distance" />
    </BlockDiagram>
  );
}
