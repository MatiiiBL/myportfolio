import { useEffect, useId, useMemo, useState } from "react";
import { ArrayGrid, type PeStatus } from "./ArrayGrid";
import { CommandLanes, PhaseBar } from "./CommandTrace";
import { MatrixTable } from "./MatrixTable";
import {
  commandTiming,
  elementsWritten,
  finishStep,
  locateCycle,
  referenceProduct,
  seededInt8Matrix,
  simulateCompute,
  type GemmOp,
} from "./systolic";
import { useMediaQuery } from "./useMediaQuery";
import "./SystolicStepper.css";

interface Preset {
  id: string;
  label: string;
  m: number;
  n: number;
  k: number;
}

const PRESETS: Preset[] = [
  { id: "full", label: "8 × 8 × 8, a full tile", m: 8, n: 8, k: 8 },
  { id: "long", label: "8 × 8 × 16, a longer K", m: 8, n: 8, k: 16 },
  { id: "partial", label: "5 × 3 × 6, a partial tile", m: 5, n: 3, k: 6 },
];

/** Operands stay small so the sums fit in a cell; the hardware takes the full INT8 range. */
const MAGNITUDE = 7;
/** Playback speed, in cycles per second: slow where the array works, faster elsewhere. */
const RATE = { load: 16, compute: 3, writeBack: 24 };

function makeOp(preset: Preset, draw: number): GemmOp {
  const seed = 1009 * (draw + 1) + preset.k;
  return {
    m: preset.m,
    n: preset.n,
    k: preset.k,
    a: seededInt8Matrix(preset.m, preset.k, seed, MAGNITUDE),
    b: seededInt8Matrix(preset.n, preset.k, seed + 7, MAGNITUDE),
  };
}

export function SystolicStepper() {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const compact = useMediaQuery("(max-width: 40rem)");
  const ids = useId();

  const [presetId, setPresetId] = useState(PRESETS[0]?.id ?? "full");
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  if (!preset) throw new Error("no presets");
  const [draw, setDraw] = useState(0);
  const op = useMemo(() => makeOp(preset, draw), [preset, draw]);
  const snapshots = useMemo(() => simulateCompute(op), [op]);
  const expected = useMemo(() => referenceProduct(op), [op]);
  const timing = useMemo(() => commandTiming(op), [op]);

  // Until the visitor moves it, the stepper opens mid-compute, where the wavefront shows at a
  // glance; with reduced motion it opens on the finished command instead.
  const [chosenCycle, setChosenCycle] = useState<number | null>(null);
  const cycle =
    chosenCycle ?? (reduceMotion ? timing.total : timing.load + Math.floor(timing.compute / 2));
  const [playRequested, setPlayRequested] = useState(false);
  const [selected, setSelected] = useState<[number, number]>([op.m - 1, op.n - 1]);

  const at = locateCycle(timing, cycle);
  const playing = playRequested && at.phase !== "done";
  useEffect(() => {
    if (!playing || at.phase === "done") return;
    const id = window.setTimeout(
      () => setChosenCycle(Math.min(timing.total, cycle + 1)),
      1000 / RATE[at.phase],
    );
    return () => window.clearTimeout(id);
  }, [playing, at.phase, cycle, timing.total]);

  const step = at.phase === "compute" ? at.inPhase : null;
  const lastIndex = snapshots.length - 1;
  const snapshot = snapshots[at.phase === "load" ? 0 : (step ?? lastIndex)] ?? snapshots[lastIndex];
  if (!snapshot) throw new Error("no snapshot");

  const isFinished = (i: number, j: number) =>
    at.phase === "writeBack" ||
    at.phase === "done" ||
    (step !== null && step > finishStep(i, j, op.k));
  const status = (i: number, j: number): PeStatus => {
    if (i >= op.m || j >= op.n) return "outside";
    if (isFinished(i, j)) return "done";
    const pe = snapshot.pe[i]?.[j];
    return pe && pe.a.k >= 0 && pe.b.k >= 0 ? "active" : "idle";
  };

  let finished = 0;
  let matching = 0;
  for (let i = 0; i < op.m; i++) {
    for (let j = 0; j < op.n; j++) {
      if (!isFinished(i, j)) continue;
      finished++;
      if (snapshot.pe[i]?.[j]?.acc === expected[i]?.[j]) matching++;
    }
  }
  const tileSize = op.m * op.n;
  const written =
    at.phase === "done" ? tileSize : at.phase === "writeBack" ? elementsWritten(op, at.inPhase) : 0;

  const go = (c: number) => {
    setPlayRequested(false);
    setChosenCycle(Math.max(0, Math.min(timing.total, c)));
  };
  const togglePlay = () => {
    if (playing) {
      setPlayRequested(false);
      return;
    }
    if (cycle >= timing.total) setChosenCycle(0);
    setPlayRequested(true);
  };
  const choosePreset = (id: string) => {
    const next = PRESETS.find((p) => p.id === id);
    if (!next) return;
    setPresetId(id);
    setPlayRequested(false);
    setSelected([next.m - 1, next.n - 1]);
    setChosenCycle(null);
  };

  const phaseText = {
    load: `Load, cycle ${at.inPhase + 1} of ${timing.load}`,
    compute: `Compute, step ${at.inPhase} of 0–${timing.compute - 1}`,
    writeBack: `Write-back, cycle ${at.inPhase + 1} of ${timing.writeBack}`,
    done: "Done",
  }[at.phase];

  const [si, sj] = selected;
  const pe = snapshot.pe[si]?.[sj];
  const inspector = (() => {
    const name = `PE (${si}, ${sj})`;
    const s = status(si, sj);
    if (s === "outside") {
      return `${name} is outside the ${op.m} × ${op.n} tile: its feeders send zeros, so it only ever adds zero.`;
    }
    if (s === "done") {
      return `${name} holds C[${si}][${sj}] = ${pe?.acc ?? 0}, final since step ${finishStep(si, sj, op.k) + 1}.`;
    }
    const pair = (k: number) => `A[${si}][${k}] × B[${sj}][${k}]`;
    if (s === "active" && pe) {
      const k = pe.a.k;
      const product = `${pe.a.value} × ${pe.b.value}`;
      return k === 0
        ? `${name}, step ${step}: multiplies ${pair(0)} = ${product}, the first pair of its sum.`
        : `${name}, step ${step}: multiplies ${pair(k)} = ${product} and adds the product for k = ${k - 1} to its sum, now ${pe.acc}.`;
    }
    const firstPair = si + sj + 3;
    if (step !== null && step > firstPair) {
      return `${name}, step ${step}: adds its last product, for k = ${op.k - 1}, to its sum, now ${pe?.acc ?? 0}.`;
    }
    return `${name} waits: ${pair(0)} reaches it at step ${firstPair}.`;
  })();

  const consumed = (i: number, k: number) => {
    if (at.phase === "load") return "";
    if (step === null) return "is-past";
    const enters = k + i + 3;
    if (step > enters) return "is-past";
    return step === enters ? "is-now" : "";
  };

  const summary =
    `${op.m} × ${op.n} × ${op.k} command, ${phaseText.toLowerCase()}; CYCLES reads ${cycle}. ` +
    `${finished} of ${tileSize} sums are final and ${matching} of them equal A × Bᵀ computed directly.`;

  return (
    <div className="stepper">
      <div className="stepper__controls">
        <button
          type="button"
          className="stepper__button stepper__button--primary"
          onClick={togglePlay}
        >
          {playing ? "Pause" : cycle >= timing.total ? "Replay" : "Play"}
        </button>
        <button
          type="button"
          className="stepper__button"
          onClick={() => go(cycle - 1)}
          disabled={cycle <= 0}
          aria-label="Back one cycle"
        >
          ← Cycle
        </button>
        <button
          type="button"
          className="stepper__button"
          onClick={() => go(cycle + 1)}
          disabled={cycle >= timing.total}
          aria-label="Forward one cycle"
        >
          Cycle →
        </button>
        <button type="button" className="stepper__button" onClick={() => go(0)}>
          Reset
        </button>
        <label className="stepper__field">
          <span>Tile</span>
          <select value={presetId} onChange={(e) => choosePreset(e.target.value)}>
            {PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="stepper__button" onClick={() => setDraw((d) => d + 1)}>
          New operands
        </button>
      </div>

      <div className="stepper__scrub">
        <label htmlFor={`${ids}-cycle`} className="stepper__readout">
          <span className="stepper__cycles">CYCLES {cycle}</span>
          <span className="stepper__phase">{phaseText}</span>
        </label>
        <input
          id={`${ids}-cycle`}
          type="range"
          min={0}
          max={timing.total}
          value={cycle}
          onChange={(e) => go(Number(e.target.value))}
          aria-valuetext={`Cycle ${cycle} of ${timing.total}: ${phaseText}`}
        />
        <PhaseBar timing={timing} at={at} />
      </div>

      <div className="stepper__main">
        <div className="stepper__array">
          <ArrayGrid
            op={op}
            snapshot={snapshot}
            step={step}
            status={status}
            selected={selected}
            onSelect={(i, j) => setSelected([i, j])}
            compact={compact}
            label={summary}
          />
          <ul className="stepper__legend" aria-hidden="true">
            <li>
              <span className="swatch swatch--active" /> multiplies this step
            </li>
            <li>
              <span className="swatch swatch--done" /> sum final
            </li>
            <li>
              <span className="swatch swatch--outside" /> outside the tile
            </li>
          </ul>
          <p className="stepper__inspector">{inspector}</p>
        </div>

        <div className="stepper__side">
          <p className="stepper__check">{summary}</p>
          <MatrixTable
            caption={`A (${op.m} × ${op.k}), enters from the west`}
            rowName="row"
            colName="k"
            cells={op.a}
            cellClass={(i, k) => consumed(i, k)}
          />
          <MatrixTable
            caption={`B (${op.n} × ${op.k}), enters from the north`}
            rowName="row"
            colName="k"
            cells={op.b}
            cellClass={(j, k) => consumed(j, k)}
          />
          <MatrixTable
            caption={`C = A × Bᵀ in DMEM (${written} of ${tileSize} written)`}
            rowName="row"
            colName="column"
            cells={expected.map((row, i) =>
              row.map((_, j) => (i * op.n + j < written ? (snapshot.pe[i]?.[j]?.acc ?? 0) : null)),
            )}
          />
        </div>
      </div>

      <CommandLanes shape={op} timing={timing} at={at} />
    </div>
  );
}
