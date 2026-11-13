import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { bruteForceKnn, recallAtK, searchHnsw, type HnswGraph, type Point } from "./hnsw";
import { EXPLORER_GRAPH, explorerGraph } from "./explorerGraph";
import { frameAt } from "./explorerState";
import { GRID } from "./points";
import { useReducedMotion } from "./useReducedMotion";
import "./HnswExplorer.css";

const K = EXPLORER_GRAPH.k;
const EF_MIN = 10;
const EF_MAX = 100;
const DEFAULT_QUERY: Point = { x: 600, y: 420 };
const END = Number.POSITIVE_INFINITY;
const PAD = 24;

/** Every undirected link on each layer, drawn once even where both ends link to each other. */
function edgesByLayer(graph: HnswGraph): [number, number][][] {
  return Array.from({ length: graph.maxLevel + 1 }, (_, layer) => {
    const seen = new Set<string>();
    const edges: [number, number][] = [];
    graph.links.forEach((layers, a) => {
      for (const b of layers[layer] ?? []) {
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        edges.push([a, b]);
      }
    });
    return edges;
  });
}

function clampToGrid(v: number): number {
  return Math.min(GRID, Math.max(0, Math.round(v)));
}

export function HnswExplorer() {
  const graph = useMemo(() => explorerGraph(), []);
  const edges = useMemo(() => edgesByLayer(graph), [graph]);
  const reduced = useReducedMotion();
  const [query, setQuery] = useState<Point>(DEFAULT_QUERY);
  const [ef, setEf] = useState(16);
  const [step, setStep] = useState(END);
  const [playing, setPlaying] = useState(false);
  const ids = useId();

  const result = useMemo(() => searchHnsw(graph, query, K, ef), [graph, query, ef]);
  const truth = useMemo(() => bruteForceKnn(graph.points, query, K), [graph, query]);
  const last = result.steps.length - 1;
  const index = Math.min(step, last);
  const frame = frameAt(result, index, graph.entryPoint, graph.maxLevel);
  const recall = recallAtK(result.neighbors, truth, K);
  // Playing stops by itself at the last step: "playing" only means "advance while there is more".
  const animating = playing && !reduced && index < last;

  useEffect(() => {
    if (!animating) return;
    const delay = Math.min(320, Math.max(70, 5200 / result.steps.length));
    const timer = window.setTimeout(() => setStep(index + 1), delay);
    return () => window.clearTimeout(timer);
  }, [animating, index, result.steps.length]);

  const place = (p: Point, replay: boolean) => {
    setQuery(p);
    setStep(replay && !reduced ? -1 : END);
    setPlaying(replay && !reduced);
  };

  const onPointer = (event: PointerEvent<SVGSVGElement>) => {
    const isDrag = event.type === "pointermove";
    if (isDrag && (event.pointerType !== "mouse" || event.buttons !== 1)) return;
    const box = event.currentTarget.getBoundingClientRect();
    const size = GRID + 2 * PAD;
    const x = ((event.clientX - box.left) / box.width) * size - PAD;
    const y = ((event.clientY - box.top) / box.height) * size - PAD;
    place({ x: clampToGrid(x), y: clampToGrid(y) }, !isDrag);
  };

  const replay = () => {
    if (reduced) return;
    setStep(-1);
    setPlaying(true);
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const delta = event.shiftKey ? 50 : 10;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-delta, 0],
      ArrowRight: [delta, 0],
      ArrowUp: [0, -delta],
      ArrowDown: [0, delta],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      place({ x: clampToGrid(query.x + move[0]), y: clampToGrid(query.y + move[1]) }, false);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      replay();
    }
  };

  const togglePlay = () => {
    if (animating) setPlaying(false);
    else if (index >= last) replay();
    else setPlaying(true);
  };

  const stepBy = (delta: number) => {
    setPlaying(false);
    setStep(Math.max(-1, Math.min(last, index + delta)));
  };

  const pts = graph.points;
  const at = (id: number) => pts[id] as Point;
  const layer = frame.layer;
  const scannedFrom = frame.current === null ? null : at(frame.current);
  const levelCounts = Array.from(
    { length: graph.maxLevel + 1 },
    (_, l) => graph.levels.filter((level) => level >= l).length,
  );

  return (
    <div className="hx">
      <div className="hx-stage">
        <div
          className="hx-plot"
          role="application"
          aria-roledescription="query picker"
          aria-label={`Query at x ${query.x}, y ${query.y}`}
          aria-describedby={`${ids}-help`}
          tabIndex={0}
          onKeyDown={onKey}
        >
          <svg
            viewBox={`${-PAD} ${-PAD} ${GRID + 2 * PAD} ${GRID + 2 * PAD}`}
            onClick={onPointer}
            onPointerMove={onPointer}
            aria-hidden="true"
            focusable="false"
          >
            <g className="hx-edges">
              {(edges[layer] ?? []).map(([a, b]) => (
                <line
                  key={`${a}-${b}`}
                  x1={at(a).x}
                  y1={at(a).y}
                  x2={at(b).x}
                  y2={at(b).y}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
            {frame.bound !== null && !frame.done && (
              <circle
                className="hx-bound"
                cx={query.x}
                cy={query.y}
                r={Math.sqrt(frame.bound)}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {scannedFrom &&
              frame.scanned.map((id) => (
                <line
                  key={`scan-${id}`}
                  className="hx-scan"
                  x1={scannedFrom.x}
                  y1={scannedFrom.y}
                  x2={at(id).x}
                  y2={at(id).y}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            <g>
              {pts.map((p, id) => {
                const level = graph.levels[id] ?? 0;
                const onLayer = level >= layer;
                const evaluated = layer === 0 && frame.evaluated.has(id);
                const className = !onLayer
                  ? "hx-node hx-off"
                  : evaluated
                    ? "hx-node hx-evaluated"
                    : layer > 0
                      ? "hx-node hx-upper"
                      : "hx-node";
                const r = !onLayer ? 4 : layer > 0 ? 10 : evaluated ? 8 : 6;
                return <circle key={id} className={className} cx={p.x} cy={p.y} r={r} />;
              })}
            </g>
            <polyline
              className="hx-path"
              points={frame.path.map((id) => `${at(id).x},${at(id).y}`).join(" ")}
              vectorEffect="non-scaling-stroke"
            />
            {frame.path.map((id, i) => (
              <circle
                key={`path-${i}`}
                className="hx-path-node"
                cx={at(id).x}
                cy={at(id).y}
                r={9}
              />
            ))}
            {!frame.done &&
              frame.results.map((id) => (
                <circle
                  key={`kept-${id}`}
                  className="hx-kept"
                  cx={at(id).x}
                  cy={at(id).y}
                  r={14}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            {frame.current !== null && (
              <circle
                className="hx-current"
                cx={at(frame.current).x}
                cy={at(frame.current).y}
                r={20}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {frame.done &&
              result.neighbors.map((n) => (
                <circle
                  key={`found-${n.id}`}
                  className="hx-found"
                  cx={at(n.id).x}
                  cy={at(n.id).y}
                  r={11}
                />
              ))}
            {frame.done &&
              truth.map((n) => (
                <circle
                  key={`true-${n.id}`}
                  className="hx-true"
                  cx={at(n.id).x}
                  cy={at(n.id).y}
                  r={19}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            <g className="hx-query" transform={`translate(${query.x} ${query.y})`}>
              <circle r={13} vectorEffect="non-scaling-stroke" />
              <path d="M -24 0 H 24 M 0 -24 V 24" vectorEffect="non-scaling-stroke" />
            </g>
          </svg>
        </div>
        <p id={`${ids}-help`} className="hx-help">
          Click or tap to place the query. With the plot focused, arrow keys move it (Shift for
          bigger steps) and Enter replays the search.
        </p>
      </div>

      <div className="hx-panel">
        <div className="hx-controls" role="group" aria-label="Search playback">
          {!reduced && (
            <button type="button" onClick={togglePlay}>
              {animating ? "Pause" : index >= last ? "Replay" : "Play"}
            </button>
          )}
          <button type="button" onClick={() => stepBy(-1)} disabled={index < 0}>
            Back
          </button>
          <button type="button" onClick={() => stepBy(1)} disabled={index >= last}>
            Step
          </button>
          <button
            type="button"
            onClick={() => {
              setPlaying(false);
              setStep(END);
            }}
            disabled={index >= last}
          >
            Result
          </button>
        </div>

        <label className="hx-slider">
          <span>
            ef <span className="hx-dim">(layer-0 candidate list)</span>
            <output>{ef}</output>
          </span>
          <input
            type="range"
            min={EF_MIN}
            max={EF_MAX}
            value={ef}
            onChange={(event) => {
              setEf(Number(event.target.value));
              setPlaying(false);
              setStep(END);
            }}
          />
        </label>

        <p className="hx-status">
          <span className="hx-dim">
            Step {Math.max(0, index + 1)} of {result.steps.length}
          </span>
          {frame.description}
        </p>

        <dl className="hx-stats">
          <div>
            <dt>Distances computed</dt>
            <dd>
              {frame.distanceCount}
              <span className="hx-dim"> of {pts.length}</span>
            </dd>
          </div>
          <div>
            <dt>Recall@{K}</dt>
            <dd>
              {frame.done ? `${Math.round(recall * K)}/${K}` : "–"}
              <span className="hx-dim"> vs brute force</span>
            </dd>
          </div>
        </dl>

        <ol className="hx-layers" aria-label="Layers, top to bottom">
          {levelCounts
            .map((count, l) => ({ count, l }))
            .reverse()
            .map(({ count, l }) => (
              <li key={l} aria-current={l === layer ? "step" : undefined}>
                <span>Layer {l}</span>
                <span className="hx-dim">
                  {count} {count === 1 ? "node" : "nodes"}
                </span>
              </li>
            ))}
        </ol>

        <ul className="hx-legend" aria-label="Legend">
          <LegendItem mark={<path className="hx-query-key" d="M2 8 H14 M8 2 V14" />}>
            Query
          </LegendItem>
          <LegendItem mark={<path className="hx-path-key" d="M1 12 L8 5 L15 8" />}>
            Greedy descent
          </LegendItem>
          <LegendItem mark={<circle className="hx-evaluated" cx="8" cy="8" r="4" />}>
            Distance computed
          </LegendItem>
          <LegendItem mark={<circle className="hx-kept-key" cx="8" cy="8" r="5.5" />}>
            Kept: best ef so far
          </LegendItem>
          <LegendItem mark={<circle className="hx-found" cx="8" cy="8" r="4.5" />}>
            Found: the {K} returned
          </LegendItem>
          <LegendItem mark={<circle className="hx-true-key" cx="8" cy="8" r="6" />}>
            True {K} nearest
          </LegendItem>
        </ul>
      </div>

      <p className="visually-hidden" aria-live="polite">
        {frame.done
          ? `Search done for the query at x ${query.x}, y ${query.y}, ef ${ef}: ` +
            `${result.distanceCount} distance computations out of ${pts.length} points, ` +
            `recall@${K} ${Math.round(recall * K)} of ${K}.`
          : ""}
      </p>
    </div>
  );
}

function LegendItem({ mark, children }: { mark: ReactNode; children: ReactNode }) {
  return (
    <li>
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
        {mark}
      </svg>
      {children}
    </li>
  );
}
