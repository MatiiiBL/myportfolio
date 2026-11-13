import "./diagrams.css";

// A schematic of one node expansion with four unvisited neighbors: the timings are illustrative
// (a miss drawn as several times a distance computation), not measured.
const MISS = 52;
const WORK = 14;
const ISSUE = 5;
const NEIGHBORS = 4;
const X0 = 16;

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
  const endA = (a.at(-1)?.work ?? 0) + WORK;
  const endB = (b.at(-1)?.work ?? 0) + WORK;
  return (
    <figure className="dg">
      <svg
        viewBox="0 0 360 214"
        role="img"
        aria-labelledby="vx-pf-title vx-pf-desc"
        className="dg-svg"
      >
        <title id="vx-pf-title">One expansion, without and with prefetching</title>
        <desc id="vx-pf-desc">
          Without prefetching, each neighbor's distance waits for its own cache miss, so four misses
          happen one after another. With prefetching, all four loads are requested first and their
          misses overlap, so the four distances finish after roughly one miss. The timings are
          schematic.
        </desc>

        <text className="dg-label" x={X0} y={18}>
          Before: load, compute, load, compute
        </text>
        {a.map((s, i) => (
          <g key={`a-${i}`}>
            <rect className="dg-miss" x={s.miss} y={28} width={MISS - 2} height={16} rx={2} />
            <rect className="dg-work" x={s.work} y={28} width={WORK - 2} height={16} rx={2} />
          </g>
        ))}

        <text className="dg-label" x={X0} y={78}>
          Prefetch: request every load, then compute
        </text>
        {b.map((s, i) => (
          <rect
            key={`b-miss-${i}`}
            className="dg-miss"
            x={s.miss}
            y={88 + i * 9}
            width={MISS - 2}
            height={7}
            rx={2}
          />
        ))}
        {b.map((s, i) => (
          <rect
            key={`b-work-${i}`}
            className="dg-work"
            x={s.work}
            y={124}
            width={WORK - 2}
            height={16}
            rx={2}
          />
        ))}
        <line className="dg-axis" x1={endB} y1={86} x2={endB} y2={146} />
        <line className="dg-axis" x1={endA} y1={24} x2={endA} y2={48} />

        <line
          className="dg-link"
          x1={X0}
          y1={166}
          x2={344}
          y2={166}
          markerEnd="url(#vx-pf-arrow)"
        />
        <text className="dg-sub" x={344} y={182} textAnchor="end">
          time (schematic)
        </text>
        <defs>
          <marker
            id="vx-pf-arrow"
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

        <g transform="translate(16 204)">
          <rect className="dg-miss" width={10} height={10} y={-9} rx={2} />
          <text className="dg-sub" x={16}>
            waiting on a cache miss
          </text>
          <rect className="dg-work" x={168} width={10} height={10} y={-9} rx={2} />
          <text className="dg-sub" x={184}>
            computing a distance
          </text>
        </g>
      </svg>
    </figure>
  );
}
