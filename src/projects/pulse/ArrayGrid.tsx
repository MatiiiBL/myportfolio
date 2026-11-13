import { ARR, type ComputeSnapshot, type GemmOp, type Operand } from "./systolic";

export type PeStatus = "outside" | "idle" | "active" | "done";

interface ArrayGridProps {
  op: GemmOp;
  snapshot: ComputeSnapshot;
  /** The compute step whose operands the edge queues preview, or null outside the compute phase. */
  step: number | null;
  status: (i: number, j: number) => PeStatus;
  selected: [number, number];
  onSelect: (i: number, j: number) => void;
  /** Narrow screens drop the edge queues and the operand labels inside each PE. */
  compact: boolean;
  label: string;
}

const CELL = 56;
const GAP = 6;
const PITCH = CELL + GAP;
const FEED = 40;
const SLOT = 30;
const ARROW = 16;

/**
 * The 8 × 8 array as the RTL builds it: A enters every row from the west and B every column
 * from the north, through one feed register per edge, and each PE keeps its own sum.
 */
export function ArrayGrid(props: ArrayGridProps) {
  const { op, snapshot, step, status, selected, onSelect, compact, label } = props;
  const slots = compact ? 0 : 3;
  const x0 = slots * SLOT + FEED + ARROW;
  const y0 = x0;
  const size = ARR * PITCH - GAP;

  // What the feed register will hold s steps from now: the next elements of the skewed rows.
  const upcoming = (rows: number[][], used: number, i: number, s: number): string => {
    if (step === null) return "";
    const k = step + s - 3 - i;
    if (i >= used || k < 0 || k >= op.k) return "";
    return String(rows[i]?.[k] ?? "");
  };
  const feedText = (o: Operand | undefined) => (o && o.k >= 0 ? String(o.value) : "·");

  return (
    <svg
      className="array-grid"
      viewBox={`0 0 ${x0 + size + 2} ${y0 + size + 2}`}
      role="img"
      aria-label={label}
    >
      <text className="array-grid__axis" x={x0 - ARROW - FEED / 2} y={y0 - 2}>
        A →
      </text>
      <text className="array-grid__axis" x={x0 - 6} y={y0 - ARROW - FEED / 2 + 4} textAnchor="end">
        B ↓
      </text>

      {Array.from({ length: ARR }, (_, i) => {
        const cy = y0 + i * PITCH + CELL / 2;
        const cx = x0 + i * PITCH + CELL / 2;
        return (
          <g key={`edge-${i}`}>
            {Array.from({ length: slots }, (_, s) => (
              <g key={s} opacity={1 - (s + 1) * 0.24}>
                <text
                  className="array-grid__queue"
                  x={x0 - ARROW - FEED - (s + 0.5) * SLOT}
                  y={cy + 4}
                >
                  {upcoming(op.a, op.m, i, s + 1)}
                </text>
                <text
                  className="array-grid__queue"
                  x={cx}
                  y={y0 - ARROW - FEED - (s + 0.5) * SLOT + 4}
                >
                  {upcoming(op.b, op.n, i, s + 1)}
                </text>
              </g>
            ))}
            <rect
              className="array-grid__feed"
              x={x0 - ARROW - FEED}
              y={cy - FEED / 2}
              width={FEED}
              height={FEED}
              rx={5}
            />
            <text className="array-grid__feed-value" x={x0 - ARROW - FEED / 2} y={cy + 5}>
              {feedText(snapshot.feedA[i])}
            </text>
            <path
              className="array-grid__arrow"
              d={`M${x0 - ARROW + 2} ${cy}h${ARROW - 6}m-4 -4l4 4l-4 4`}
            />
            <rect
              className="array-grid__feed"
              x={cx - FEED / 2}
              y={y0 - ARROW - FEED}
              width={FEED}
              height={FEED}
              rx={5}
            />
            <text className="array-grid__feed-value" x={cx} y={y0 - ARROW - FEED / 2 + 5}>
              {feedText(snapshot.feedB[i])}
            </text>
            <path
              className="array-grid__arrow"
              d={`M${cx} ${y0 - ARROW + 2}v${ARROW - 6}m-4 -4l4 4l4 -4`}
            />
          </g>
        );
      })}

      {snapshot.pe.map((row, i) =>
        row.map((pe, j) => {
          const x = x0 + j * PITCH;
          const y = y0 + i * PITCH;
          const state = status(i, j);
          const isSelected = selected[0] === i && selected[1] === j;
          return (
            <g
              key={`${i}-${j}`}
              className={`pe pe--${state}${isSelected ? " pe--selected" : ""}`}
              onPointerEnter={(e) => {
                if (e.pointerType === "mouse") onSelect(i, j);
              }}
              onClick={() => onSelect(i, j)}
            >
              <rect className="pe__cell" x={x} y={y} width={CELL} height={CELL} rx={6} />
              {!compact && state === "active" && (
                <>
                  <text className="pe__operand" x={x + 6} y={y + 14}>
                    {pe.a.value}
                  </text>
                  <text className="pe__operand" x={x + CELL - 6} y={y + 14} textAnchor="end">
                    {pe.b.value}
                  </text>
                </>
              )}
              <text
                className="pe__acc"
                x={x + CELL / 2}
                y={y + CELL / 2 + (compact ? 7 : 10)}
                fontSize={compact ? 20 : 16}
              >
                {pe.acc}
              </text>
            </g>
          );
        }),
      )}
    </svg>
  );
}
