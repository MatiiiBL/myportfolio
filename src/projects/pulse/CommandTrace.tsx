import {
  dmaSchedule,
  elementsWritten,
  type CommandCycle,
  type CommandTiming,
  type GemmOp,
  type Phase,
} from "./systolic";

interface CommandTraceProps {
  shape: Pick<GemmOp, "m" | "n" | "k">;
  timing: CommandTiming;
  at: CommandCycle;
}

const PHASES: { phase: Exclude<Phase, "done">; name: string; key: keyof CommandTiming }[] = [
  { phase: "load", name: "Load", key: "load" },
  { phase: "compute", name: "Compute", key: "compute" },
  { phase: "writeBack", name: "Write-back", key: "writeBack" },
];

type RowState = "waiting" | "reading" | "loaded";

/** The command's three phases to scale, with a playhead at the current cycle. */
export function PhaseBar({ timing, at }: Omit<CommandTraceProps, "shape">) {
  return (
    <div className="command">
      <div className="command__bar" aria-hidden="true">
        {PHASES.map(({ phase, key }) => (
          <span
            key={phase}
            className={`command__segment${at.phase === phase ? " command__segment--now" : ""}`}
            style={{ flexGrow: timing[key] }}
          />
        ))}
        <span
          className="command__playhead"
          style={{ left: `${(100 * at.cycle) / timing.total}%` }}
        />
      </div>
      <ol className="command__phases">
        {PHASES.map(({ phase, name, key }) => (
          <li key={phase} className={at.phase === phase ? "is-now" : undefined}>
            <span className="command__phase-name">{name}</span> {timing[key]} cycles
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The rest of the command around the array: the CPU's register writes and polling, the DMA
 * bringing each row into the operand buffers, and the write-back draining C into DMEM.
 */
export function CommandLanes({ shape, timing, at }: CommandTraceProps) {
  const reads = dmaSchedule(shape);
  // A read issued in load cycle r has its data on the bus in cycle r + 1.
  const readState = (r: number): RowState => {
    if (at.phase !== "load") return "loaded";
    if (r < at.inPhase - 1) return "loaded";
    return r <= at.inPhase ? "reading" : "waiting";
  };
  const rowState = (operand: "A" | "B", row: number): RowState => {
    const states = reads
      .map((read, r) => (read.operand === operand && read.row === row ? readState(r) : null))
      .filter((s): s is RowState => s !== null);
    if (states.every((s) => s === "loaded")) return "loaded";
    return states.some((s) => s !== "waiting") ? "reading" : "waiting";
  };
  const written =
    at.phase === "done"
      ? shape.m * shape.n
      : at.phase === "writeBack"
        ? elementsWritten(shape, at.inPhase)
        : 0;
  const busy = at.phase !== "done";

  return (
    <div className="command__lanes">
      <section className="command__lane" aria-label="CPU">
        <h3 className="command__lane-title">CPU, the driver</h3>
        <pre className="command__code">
          <code>
            <span className="is-past">{"sw  strides, QUANT, QMULT\n"}</span>
            <span className="is-past">{"sw  A_ADDR … K       (7 writes)\n"}</span>
            <span className="is-past">{"sw  CTRL ← START\n"}</span>
            <span className={busy ? "is-now" : "is-past"}>
              {`lw  STATUS          ${busy ? "BUSY, poll" : "DONE"}\n`}
            </span>
            <span className={busy ? undefined : "is-now"}>
              {`lw  CYCLES          ${busy ? "" : `→ ${timing.total}`}`}
            </span>
          </code>
        </pre>
      </section>

      <section className="command__lane" aria-label="DMA">
        <h3 className="command__lane-title">DMA, 16 bytes per cycle</h3>
        {(["A", "B"] as const).map((operand) => (
          <ul key={operand} className="command__rows" aria-label={`Rows of ${operand}`}>
            {Array.from({ length: operand === "A" ? shape.m : shape.n }, (_, row) => {
              const state = rowState(operand, row);
              return (
                <li key={row} className={`command__row command__row--${state}`}>
                  {operand}
                  {row}
                  <span className="visually-hidden"> {state}</span>
                </li>
              );
            })}
          </ul>
        ))}
        <p className="command__note">DMEM port B to the operand buffers</p>
      </section>

      <section className="command__lane" aria-label="Write-back">
        <h3 className="command__lane-title">Write-back, 1 element per cycle</h3>
        <p className="command__count">
          <span className="command__count-value">{written}</span> of {shape.m * shape.n}
        </p>
        <p className="command__note">elements of C in DMEM, after a 6-stage pipeline</p>
      </section>
    </div>
  );
}
