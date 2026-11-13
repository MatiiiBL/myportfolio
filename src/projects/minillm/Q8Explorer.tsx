import { useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Bar,
  ReferenceLine,
  YAxis,
  axisTicks,
  bandScale,
  numericScale,
  type PlotBox,
} from "../../components/charts";
import { useWidth } from "../../components/charts/useWidth";
import data from "./data/q8-blocks.json";
import { BLOCK, BLOCK_BYTES, dequantize, f16ToF32, quantizeBlock } from "./q8_0";
import "./Q8Explorer.css";

interface Source {
  tensor: string;
  row: number;
  firstColumn: number;
  kind: string;
  values: number[];
}

const BLOCKS = data.blocks as Source[];
const EMPTY: Source = { tensor: "", row: 0, firstColumn: 0, kind: "", values: [] };
const COLUMNS = Array.from({ length: BLOCK }, (_, j) => String(j));

/** "model.layers.15.mlp.down_proj.weight" → "layer 15 down_proj". */
function shortName(tensor: string): string {
  if (tensor === "model.embed_tokens.weight") return "embedding";
  const match = /layers\.(\d+)\.\w+\.(\w+)\.weight/.exec(tensor);
  return match ? `layer ${match[1]} ${match[2]}` : tensor;
}

function blockLabel(b: Source): string {
  const row = b.tensor === "model.embed_tokens.weight" ? `token "Paris"` : `row ${b.row}`;
  const columns = `${b.firstColumn}–${b.firstColumn + BLOCK - 1}`;
  return `${shortName(b.tensor)}, ${row}, columns ${columns} (${b.kind})`;
}

function fmt(v: number): string {
  if (v === 0) return "0";
  return Math.abs(v) >= 0.01 ? v.toFixed(4) : v.toExponential(2);
}

const HEIGHT_WEIGHTS = 176;
const HEIGHT_ERRORS = 132;

/** One Q8_0 block of real SmolLM2-135M weights: its scale, its int8 values and what rounding cost. */
export function Q8Explorer() {
  const [blockIndex, setBlockIndex] = useState(1);
  const [edits, setEdits] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState(0);
  const plotRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const width = useWidth(plotRef, 640);
  const ids = useId();

  const original = (BLOCKS[blockIndex] ?? EMPTY).values;
  const values = useMemo(() => original.map((v, j) => edits[j] ?? v), [original, edits]);
  const block = useMemo(() => quantizeBlock(values), [values]);
  const back = dequantize(block);
  const d = f16ToF32(block.d);
  const errors = values.map((x, j) => x - (back[j] ?? 0));
  const edited = Object.keys(edits).length > 0;
  const originalAmax = Math.max(...original.map(Math.abs));
  const amax = Math.max(...values.map(Math.abs));
  const maxError = Math.max(...errors.map(Math.abs));
  const rms = Math.sqrt(errors.reduce((s, e) => s + e * e, 0) / BLOCK);

  const chooseBlock = (index: number) => {
    setBlockIndex(index);
    setEdits({});
  };

  const select = (j: number, focus: boolean) => {
    const next = Math.max(0, Math.min(BLOCK - 1, j));
    setSelected(next);
    if (focus) cellRefs.current[next]?.focus();
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, number> = {
      ArrowLeft: selected - 1,
      ArrowRight: selected + 1,
      ArrowUp: selected - 8,
      ArrowDown: selected + 8,
      Home: 0,
      End: BLOCK - 1,
    };
    const next = moves[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(next, true);
  };

  // Two stacked plots sharing one band of 32 columns.
  const left = 52;
  const right = width - 8;
  const x = bandScale(COLUMNS, [left, right]);
  const band = x.bandwidth();
  const weightsBox: PlotBox = { left, right, top: 28, bottom: HEIGHT_WEIGHTS - 8 };
  const errorsBox: PlotBox = {
    left,
    right,
    top: HEIGHT_WEIGHTS + 30,
    bottom: HEIGHT_WEIGHTS + HEIGHT_ERRORS - 10,
  };
  const wDomain: [number, number] = [-amax * 1.08, amax * 1.08];
  const wScale = numericScale({ type: "linear", domain: wDomain }, wDomain, [
    weightsBox.bottom,
    weightsBox.top,
  ]);
  const eLimit = Math.max(d / 2, maxError) * 1.3 || 1;
  const eDomain: [number, number] = [-eLimit, eLimit];
  const eScale = numericScale({ type: "linear", domain: eDomain }, eDomain, [
    errorsBox.bottom,
    errorsBox.top,
  ]);
  const wTicks = axisTicks({ type: "linear" }, wScale, weightsBox.bottom - weightsBox.top, 40);
  const eTicks = [-d / 2, 0, d / 2];
  const thickness = Math.max(2, Math.min(band, 14));
  const offset = (band - thickness) / 2;
  const sel = values[selected] ?? 0;
  const q = block.qs[selected] ?? 0;

  return (
    <div className="q8">
      <div className="q8-bar">
        <label className="q8-select">
          <span>Block</span>
          <select value={blockIndex} onChange={(e) => chooseBlock(Number(e.target.value))}>
            {BLOCKS.map((b, i) => (
              <option key={i} value={i}>
                {blockLabel(b)}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="q8-button" onClick={() => setEdits({})} disabled={!edited}>
          Reset block
        </button>
      </div>

      <div ref={plotRef} className="q8-plot">
        <svg
          className="chart-svg"
          viewBox={`0 0 ${width} ${HEIGHT_WEIGHTS + HEIGHT_ERRORS}`}
          width="100%"
          height={HEIGHT_WEIGHTS + HEIGHT_ERRORS}
          aria-hidden="true"
          focusable="false"
        >
          <YAxis
            scale={wScale}
            ticks={wTicks}
            format={(v) => (v === 0 ? "0" : v.toFixed(2))}
            plot={weightsBox}
            label={edited ? "weight (edited block)" : "weight"}
          />
          {values.map((v, j) => (
            <Bar
              key={`w-${j}`}
              orientation="vertical"
              from={wScale(0)}
              to={wScale(v)}
              start={(x(String(j)) ?? 0) + offset}
              thickness={thickness}
              color={j === selected ? 1 : 2}
            />
          ))}
          <line className="chart-baseline" x1={left} x2={right} y1={wScale(0)} y2={wScale(0)} />

          <YAxis
            scale={eScale}
            ticks={eTicks}
            format={(v) => (v === 0 ? "0" : v > 0 ? "+d/2" : "−d/2")}
            plot={errorsBox}
            label="rounding error, x − q·d"
            grid={false}
          />
          <ReferenceLine orientation="horizontal" at={eScale(d / 2)} label="" plot={errorsBox} />
          <ReferenceLine orientation="horizontal" at={eScale(-d / 2)} label="" plot={errorsBox} />
          {errors.map((e, j) => (
            <Bar
              key={`e-${j}`}
              orientation="vertical"
              from={eScale(0)}
              to={eScale(e)}
              start={(x(String(j)) ?? 0) + offset}
              thickness={thickness}
              color={j === selected ? 1 : 3}
            />
          ))}
          <line className="chart-baseline" x1={left} x2={right} y1={eScale(0)} y2={eScale(0)} />
          {COLUMNS.map((c, j) => (
            <rect
              key={`hit-${c}`}
              className="q8-hit"
              x={x(c) ?? 0}
              y={weightsBox.top}
              width={band}
              height={errorsBox.bottom - weightsBox.top}
              onClick={() => select(j, false)}
            />
          ))}
        </svg>
      </div>

      <div className="q8-lower">
        <div>
          <p id={`${ids}-grid`} className="q8-label">
            The 32 int8 values (pick one; arrow keys move)
          </p>
          <div
            className="q8-grid"
            role="group"
            aria-labelledby={`${ids}-grid`}
            onKeyDown={onGridKey}
          >
            {block.qs.map((v, j) => (
              <button
                key={j}
                ref={(el) => {
                  cellRefs.current[j] = el;
                }}
                type="button"
                className="q8-cell"
                aria-pressed={j === selected}
                aria-label={`Weight ${j}: ${fmt(values[j] ?? 0)}, stored as ${v}`}
                tabIndex={j === selected ? 0 : -1}
                onClick={() => select(j, false)}
              >
                {v}
              </button>
            ))}
          </div>
          <label className="q8-slider">
            <span>
              Change weight {selected}
              <output>{fmt(sel)}</output>
            </span>
            <input
              type="range"
              min={-3 * originalAmax}
              max={3 * originalAmax}
              step={originalAmax / 200}
              value={sel}
              aria-valuetext={fmt(sel)}
              onChange={(e) =>
                setEdits({ ...edits, [selected]: Math.fround(Number(e.target.value)) })
              }
            />
          </label>
        </div>

        <dl className="q8-readout">
          <div>
            <dt>Weight {selected}</dt>
            <dd>{fmt(sel)}</dd>
          </div>
          <div>
            <dt>× 1/d, rounded</dt>
            <dd>
              {fmt(sel / (d || 1))} → {q}
            </dd>
          </div>
          <div>
            <dt>q · d</dt>
            <dd>{fmt(back[selected] ?? 0)}</dd>
          </div>
          <div>
            <dt>Error</dt>
            <dd>{fmt(errors[selected] ?? 0)}</dd>
          </div>
          <div>
            <dt>Scale d = f16(amax / 127)</dt>
            <dd>
              {fmt(d)} <span className="q8-dim">0x{block.d.toString(16).padStart(4, "0")}</span>
            </dd>
          </div>
          <div>
            <dt>Block error, max / RMS</dt>
            <dd>
              {fmt(maxError)} / {fmt(rms)}
            </dd>
          </div>
        </dl>
      </div>
      <p className="q8-note">
        {BLOCK_BYTES} bytes for these 32 weights instead of {4 * BLOCK} in f32:{" "}
        {((4 * BLOCK) / BLOCK_BYTES).toFixed(2)}× smaller. Rounding against the stored scale keeps
        every error within d/2, so the largest weight in the block sets the error of all 32.
      </p>
    </div>
  );
}
