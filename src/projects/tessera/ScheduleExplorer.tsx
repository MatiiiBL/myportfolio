import { useEffect, useId, useMemo, useState } from "react";
import { Figure } from "../../components/Figure";
import { AccessView } from "./AccessView";
import { printLines } from "./schedule/ir";
import {
  DOC_KERNEL,
  defaultConfig,
  knobSpace,
  scheduleMatmul,
  type MatmulConfig,
  type Order,
} from "./schedule/matmul";
import { tileFacts, tileSteps, type TileStep } from "./schedule/tiles";
import { SourceLink } from "../../components/SourceLink";
import { SOURCE } from "./source";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "./ScheduleExplorer.css";

const SHAPE = DOC_KERNEL;
const SPACE = knobSpace(SHAPE);
const DEFAULTS = defaultConfig(SHAPE);
// One pass of the tile loop takes about this long when played, whatever the tile count.
const PASS_SECONDS = 12;

const ORDER_LABEL: Record<Order, string> = {
  nm: "nm: column strips outside",
  mn: "mn: row tiles outside",
};

function describeStep(step: TileStep, cfg: MatmulConfig): string {
  const r0 = step.row * cfg.tile_m;
  const c0 = step.col * cfg.tile_n;
  const where =
    cfg.order === "nm"
      ? `n_0 = ${step.col}, m_0 = ${step.row}`
      : `m_0_n_0_fused = ${step.outer} (row tile ${step.row}, column tile ${step.col})`;
  const span = (lo: number, n: number) => (n === 1 ? `${lo}` : `${lo}–${lo + n - 1}`);
  return `${where}: rows ${span(r0, cfg.tile_m)}, columns ${span(c0, cfg.tile_n)}`;
}

export function ScheduleExplorer() {
  const [cfg, setCfg] = useState<MatmulConfig>(DEFAULTS);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [pinned, setPinned] = useState<number | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const id = useId();

  const scheduled = useMemo(() => scheduleMatmul(SHAPE, cfg), [cfg]);
  const lines = useMemo(() => printLines(scheduled.func), [scheduled]);
  const steps = useMemo(() => tileSteps(SHAPE, cfg), [cfg]);
  const facts = tileFacts(SHAPE, cfg);
  const last = steps.length - 1;
  const current = steps[Math.min(index, last)] as TileStep;
  const highlight = hovered ?? pinned;
  // Playback stops by itself at the last tile.
  const running = playing && !reduced && index < last;
  const outerExtent =
    cfg.order === "nm" ? SHAPE.n / cfg.tile_n : (SHAPE.m / cfg.tile_m) * (SHAPE.n / cfg.tile_n);

  const update = (change: Partial<MatmulConfig>) => {
    setCfg((c) => ({ ...c, ...change }));
    setIndex(0);
    setPinned(null);
  };

  useEffect(() => {
    if (!running) return;
    const perSecond = Math.max(6, steps.length / PASS_SECONDS);
    let frame = 0;
    let previous: number | null = null;
    let carry = 0;
    const tick = (now: number) => {
      if (previous !== null) carry += ((now - previous) / 1000) * perSecond;
      previous = now;
      const advance = Math.floor(carry);
      carry -= advance;
      if (advance > 0) setIndex((i) => Math.min(steps.length - 1, i + advance));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, steps.length]);

  const togglePlay = () => {
    if (running) {
      setPlaying(false);
      return;
    }
    if (index >= last) setIndex(0);
    setPlaying(true);
  };

  const radio = <K extends "tile_m" | "tile_n" | "order">(
    knob: K,
    legend: string,
    options: MatmulConfig[K][],
    label: (o: MatmulConfig[K]) => string,
  ) => (
    <fieldset className="knob">
      <legend className="knob-name">{legend}</legend>
      <div className="segmented">
        {options.map((o) => (
          <label key={String(o)} className="segment">
            <input
              type="radio"
              name={`${id}${knob}`}
              checked={cfg[knob] === o}
              onChange={() => update({ [knob]: o } as Partial<MatmulConfig>)}
            />
            <span>{label(o)}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );

  return (
    <Figure
      title="One kernel, rescheduled"
      subtitle="relu(A @ W + b) · A 64×256 · W 256×128 · Tessera's matmul template on c:generic"
      caption={
        <>
          Each control is one of the template&apos;s knobs. The trace lists the schedule primitives
          the template applies; select one to mark the lines of loop IR it produced. The access view
          steps through the loop above the reduction: the register tile of the output it
          accumulates, the rows of A and the strip of W it reads. The trace and the loop IR are
          checked against Tessera&apos;s own output at all 224 points of the knob space. Source:{" "}
          <SourceLink {...SOURCE} file="src/tessera/backend/c/templates/matmul.py" />; this is the
          kernel <SourceLink {...SOURCE} file="docs/cpu.md" anchor="generated-code" /> prints as
          generated C.
        </>
      }
    >
      <div className="explorer">
        <div className="explorer-controls">
          {radio("tile_m", "tile_m (rows per register tile)", SPACE.tile_m, String)}
          {radio("tile_n", "tile_n (vector columns)", SPACE.tile_n, String)}
          {radio("order", "order", SPACE.order, (o) => ORDER_LABEL[o])}
          <fieldset className="knob">
            <legend className="knob-name">switches</legend>
            <label className="check">
              <input
                type="checkbox"
                checked={cfg.pack_b}
                onChange={(e) => update({ pack_b: e.target.checked })}
              />
              <span>
                pack_b <span className="knob-hint">(copy each strip of W; nm only)</span>
              </span>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={cfg.parallel}
                onChange={(e) => update({ parallel: e.target.checked })}
              />
              <span>
                parallel <span className="knob-hint">(outer loop on the thread pool)</span>
              </span>
            </label>
            <button
              type="button"
              className="text-button"
              onClick={() => update(DEFAULTS)}
              disabled={JSON.stringify(cfg) === JSON.stringify(DEFAULTS)}
            >
              Reset to the defaults
            </button>
          </fieldset>
        </div>

        <div className="explorer-main">
          <div className="explorer-access">
            <AccessView
              shape={SHAPE}
              cfg={cfg}
              steps={steps}
              index={index}
              packed={scheduled.packed}
            />
            <ul className="access-legend" aria-label="Access view key">
              <li>
                <span className="key key-tile" aria-hidden="true" /> register tile being computed
              </li>
              <li>
                <span className="key key-read" aria-hidden="true" /> read by its reduction loop
              </li>
              {scheduled.packed && (
                <li>
                  <span className="key key-source" aria-hidden="true" /> strip copied into W_local
                </li>
              )}
              <li>
                <span className="key key-done" aria-hidden="true" /> tiles finished
              </li>
            </ul>
            <div className="stepper">
              {!reduced && (
                <button type="button" className="step-button" onClick={togglePlay}>
                  {running ? "Pause" : "Play"}
                </button>
              )}
              <button
                type="button"
                className="step-button"
                aria-label="Previous tile"
                onClick={() => setIndex((i) => Math.max(0, i - 1))}
                disabled={index === 0}
              >
                ‹
              </button>
              <button
                type="button"
                className="step-button"
                aria-label="Next tile"
                onClick={() => setIndex((i) => Math.min(last, i + 1))}
                disabled={index >= last}
              >
                ›
              </button>
              <input
                type="range"
                className="step-range"
                min={0}
                max={last}
                value={Math.min(index, last)}
                onChange={(e) => {
                  setPlaying(false);
                  setIndex(Number(e.target.value));
                }}
                aria-label="Tile"
                aria-valuetext={`Tile ${Math.min(index, last) + 1} of ${steps.length}`}
              />
            </div>
            <p className="step-label" aria-live={running ? "off" : "polite"}>
              Tile {Math.min(index, last) + 1} of {steps.length}
              {current.packs ? " · copies its strip of W first" : ""}
              <br />
              <span className="step-where">{describeStep(current, cfg)}</span>
            </p>
            <dl className="facts">
              <div>
                <dt>Register tile</dt>
                <dd>
                  {cfg.tile_m} × {cfg.tile_n} = {facts.accumulators} accumulators
                </dd>
              </div>
              <div>
                <dt>Reuse per load</dt>
                <dd>{formatRatio(facts.macsPerLoad)} multiply-adds per element of A or W loaded</dd>
              </div>
              <div>
                <dt>Strip of W</dt>
                <dd>
                  {SHAPE.k} × {cfg.tile_n} floats ({formatBytes(facts.stripBytes)})
                  {scheduled.packed
                    ? ", copied once per strip"
                    : cfg.order === "nm"
                      ? ", read in place, rows 128 floats apart"
                      : `, used again ${facts.stripReuseDistance} tiles later`}
                </dd>
              </div>
              <div>
                <dt>Thread pool</dt>
                <dd>
                  {scheduled.parallelLoop
                    ? `${scheduled.parallelLoop}: ${outerExtent} iterations shared by the threads`
                    : "none: every loop runs on the calling thread"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="explorer-ir">
            <p className="ir-heading" id={`${id}trace`}>
              Trace
            </p>
            <ol className="trace" aria-labelledby={`${id}trace`}>
              {scheduled.trace.map((line, i) => (
                <li key={`${i}${line}`}>
                  <button
                    type="button"
                    className={highlight === i ? "trace-step is-active" : "trace-step"}
                    aria-pressed={pinned === i}
                    onClick={() => setPinned((p) => (p === i ? null : i))}
                    onPointerEnter={() => setHovered(i)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(i)}
                    onBlur={() => setHovered(null)}
                  >
                    {line}
                  </button>
                </li>
              ))}
            </ol>
            <p className="ir-heading">Loop IR</p>
            <pre className="ir" aria-label="Scheduled loop IR">
              <code>
                {lines.map((l, i) => (
                  <span
                    key={i}
                    className={
                      highlight !== null && l.origin === highlight ? "ir-line is-marked" : "ir-line"
                    }
                    style={{ paddingLeft: `${l.depth * 2 + 2}ch` }}
                  >
                    {l.text}
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
          </div>
        </div>
      </div>
    </Figure>
  );
}

function formatRatio(x: number): string {
  return Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/0$/, "");
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ? `${bytes / 1024} KiB` : `${bytes} B`;
}
