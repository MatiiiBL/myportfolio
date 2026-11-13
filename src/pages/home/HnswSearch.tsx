import {
  memo,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { buildGraph, HOME_EF, HOME_GRAPH_OPTIONS, search, type Point } from "./hnsw";
import { layersLayout, planeAt, planeOutline, project, unproject } from "./layers";
import "./HnswSearch.css";

const graph = buildGraph(HOME_GRAPH_OPTIONS);
const layout = layersLayout(graph.top + 1);
const START: Point = { x: 0.2, y: 0.78 };
const STEP_MS = 140;
const KEY_STEP = 0.04;

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Every point and link of every layer: drawn once, it never changes. */
const Layers = memo(function Layers() {
  return (
    <g>
      {layout.planes.map((plane, layer) => {
        const on = (i: number) => (graph.levels[i] ?? 0) >= layer;
        const at = (i: number) => project(graph.points[i] ?? START, plane);
        const edges: [number, number][] = [];
        graph.links[layer]?.forEach((neighbors, i) => {
          for (const j of neighbors)
            if (i < j || !graph.links[layer]?.[j]?.includes(i)) edges.push([i, j]);
        });
        return (
          <g key={layer}>
            <path className="hnsw-plane" d={planeOutline(plane)} />
            <text
              className="hnsw-label"
              x={plane.left + plane.width + plane.skew + 12}
              y={plane.top + plane.depth / 2 + 4}
            >
              L{layer}
            </text>
            {edges.map(([i, j]) => {
              const a = at(i);
              const b = at(j);
              return (
                <line
                  key={`${i}-${j}`}
                  className="hnsw-edge"
                  x1={r2(a.x)}
                  y1={r2(a.y)}
                  x2={r2(b.x)}
                  y2={r2(b.y)}
                />
              );
            })}
            {graph.points.map((_, i) => {
              if (!on(i)) return null;
              const p = at(i);
              return (
                <circle
                  key={i}
                  className="hnsw-node"
                  cx={r2(p.x)}
                  cy={r2(p.y)}
                  r={layer === 0 ? 2.2 : 3}
                />
              );
            })}
          </g>
        );
      })}
    </g>
  );
});

/**
 * The home page's signature piece: a real HNSW index over 96 points in three layers. Wherever
 * the visitor points (or moves the query with the arrow keys), the search runs again and its
 * route is drawn: greedy hops on the upper layers, a drop at each layer, a beam search on
 * layer 0. A click, a tap or Enter replays the descent step by step.
 */
export function HnswSearch() {
  const [query, setQuery] = useState<Point>(START);
  const [replay, setReplay] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const hintId = `${useId()}hint`;
  const trace = useMemo(() => search(graph, query, HOME_EF), [query]);

  const describe = (q: Point) => {
    const t = search(graph, q, HOME_EF);
    const verdict =
      t.result === t.exact
        ? "the same point an exhaustive scan finds"
        : "a near neighbor; an exhaustive scan finds a closer one";
    return `Query at ${q.x.toFixed(2)}, ${q.y.toFixed(2)}: ${t.distances} distance computations instead of ${graph.points.length}, and the result is ${verdict}.`;
  };

  const pointToQuery = (event: PointerEvent<SVGSVGElement>): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) * layout.width) / rect.width;
    const y = ((event.clientY - rect.top) * layout.height) / rect.height;
    const plane = layout.planes[planeAt(y, layout)];
    return plane ? unproject(x, y, plane) : null;
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP, 0],
      ArrowRight: [KEY_STEP, 0],
      ArrowUp: [0, -KEY_STEP],
      ArrowDown: [0, KEY_STEP],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      const next = {
        x: Math.min(1, Math.max(0, r2(query.x + move[0]))),
        y: Math.min(1, Math.max(0, r2(query.y + move[1]))),
      };
      setQuery(next);
      setAnnouncement(describe(next));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setReplay((n) => n + 1);
      setAnnouncement(describe(query));
    }
  };

  // Steps in drawing order: the hops on each layer, then the drop to the next one.
  let step = 0;
  const delay = (i: number) => ({ animationDelay: `${i * STEP_MS}ms` });
  const route = trace.layers.map(({ layer, path }, k) => {
    const plane = layout.planes[layer];
    const below = layout.planes[layer - 1];
    if (!plane) return null;
    const at = (i: number) => project(graph.points[i] ?? START, plane);
    const hops = path.slice(1).map((node, h) => {
      const a = at(path[h] ?? node);
      const b = at(node);
      const i = step++;
      return (
        <g key={`${layer}-${node}`}>
          <line
            className="hnsw-hop"
            pathLength={1}
            x1={r2(a.x)}
            y1={r2(a.y)}
            x2={r2(b.x)}
            y2={r2(b.y)}
            style={delay(i)}
          />
          <circle className="hnsw-stop" cx={r2(b.x)} cy={r2(b.y)} r={3.6} style={delay(i + 1)} />
        </g>
      );
    });
    const start = at(path[0] ?? graph.entry);
    const last = path[path.length - 1] ?? graph.entry;
    const end = at(last);
    const drop = below
      ? (() => {
          const i = step++;
          const to = project(graph.points[last] ?? START, below);
          return (
            <line
              className="hnsw-drop"
              x1={r2(end.x)}
              y1={r2(end.y)}
              x2={r2(to.x)}
              y2={r2(to.y)}
              style={delay(i)}
            />
          );
        })()
      : null;
    return (
      <g key={layer}>
        {k === 0 && (
          <circle className="hnsw-stop is-entry" cx={r2(start.x)} cy={r2(start.y)} r={4.2} />
        )}
        {hops}
        {drop}
      </g>
    );
  });

  const visited = trace.layers.flatMap(({ layer, visited: v }) => {
    const plane = layout.planes[layer];
    if (!plane) return [];
    return v.map((i) => {
      const p = project(graph.points[i] ?? START, plane);
      return (
        <circle key={`${layer}-${i}`} className="hnsw-visited" cx={r2(p.x)} cy={r2(p.y)} r={4.6} />
      );
    });
  });

  const q0 = layout.planes[0] ? project(query, layout.planes[0]) : { x: 0, y: 0 };
  const result = layout.planes[0]
    ? project(graph.points[trace.result] ?? START, layout.planes[0])
    : { x: 0, y: 0 };

  return (
    <figure className="hnsw">
      <svg
        ref={svgRef}
        className="hnsw-svg"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="group"
        aria-label="HNSW search demo: a three-layer graph with the route of a nearest-neighbor search drawn on it"
        aria-describedby={hintId}
        tabIndex={0}
        onPointerMove={(event) => {
          const q = pointToQuery(event);
          if (q) setQuery(q);
        }}
        onPointerDown={(event) => {
          const q = pointToQuery(event);
          if (!q) return;
          setQuery(q);
          setReplay((n) => n + 1);
          setAnnouncement(describe(q));
        }}
        onKeyDown={onKeyDown}
      >
        <Layers />
        {layout.planes.slice(1).map((plane, k) => {
          const p = project(query, plane);
          return (
            <path
              key={k}
              className="hnsw-ghost"
              d={`M${r2(p.x - 4)},${r2(p.y)}h8M${r2(p.x)},${r2(p.y - 4)}v8`}
            />
          );
        })}
        <g key={replay} className={replay > 0 ? "hnsw-route is-replaying" : "hnsw-route"}>
          {visited}
          {route}
          <circle
            className="hnsw-result"
            cx={r2(result.x)}
            cy={r2(result.y)}
            r={7}
            style={delay(step)}
          />
        </g>
        <circle className="hnsw-query" cx={r2(q0.x)} cy={r2(q0.y)} r={4} />
        <text className="hnsw-query-label" x={r2(q0.x + 8)} y={r2(q0.y - 8)}>
          q
        </text>
      </svg>
      <figcaption className="hnsw-caption">
        <span className="hnsw-readout">
          {trace.distances} of {graph.points.length} distances computed ·{" "}
          {trace.result === trace.exact ? "same answer as a full scan" : "a full scan finds closer"}
        </span>
        <span id={hintId} className="hnsw-hint">
          A search on an HNSW graph, the index behind vecdex: greedy hops toward the query q on each
          upper layer, a drop where it can get no closer, then a beam search on layer 0. Point, tap
          or use the arrow keys to move q.
        </span>
      </figcaption>
      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </figure>
  );
}
