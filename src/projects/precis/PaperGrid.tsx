import { useEffect, useRef } from "react";
import { useWidth } from "../../components/charts/useWidth";
import type { PaperState, Transition } from "./sim/pipeline";
import { STATE_TOKENS } from "./stateTokens";
import { useThemeKey } from "./useThemeKey";

const COLUMNS = 50;
const GAP = 1;

interface PaperGridProps {
  papers: number;
  transitions: Transition[];
  t: number;
}

/**
 * One cell per paper, in the order the scheduler admits them, colored by the stage it is in at
 * simulated time `t`. Thousands of marks, so it is drawn on a canvas.
 */
export function PaperGrid({ papers, transitions, t }: PaperGridProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const width = useWidth(wrap, 480);
  const theme = useThemeKey();
  const cell = Math.max(
    3,
    Math.min(11, Math.floor((Math.min(width, 560) - (COLUMNS - 1) * GAP) / COLUMNS)),
  );
  const rows = Math.ceil(papers / COLUMNS);
  const w = COLUMNS * (cell + GAP) - GAP;
  const h = rows * (cell + GAP) - GAP;

  // States at time t, replayed from the transitions; moving forward only applies the new ones.
  const replay = useRef<{ list: Transition[]; at: number; next: number; states: PaperState[] }>(
    null,
  );

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    let r = replay.current;
    if (!r || r.list !== transitions || t < r.at || r.states.length !== papers) {
      r = { list: transitions, at: 0, next: 0, states: Array<PaperState>(papers).fill(0) };
    }
    while (r.next < transitions.length && (transitions[r.next] as Transition).t <= t) {
      const tr = transitions[r.next] as Transition;
      r.states[tr.paper] = tr.state;
      r.next += 1;
    }
    r.at = t;
    replay.current = r;

    const ratio = window.devicePixelRatio || 1;
    el.width = Math.round(w * ratio);
    el.height = Math.round(h * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const style = getComputedStyle(el);
    const colors = STATE_TOKENS.map((token) => style.getPropertyValue(token).trim());
    ctx.clearRect(0, 0, w, h);
    r.states.forEach((state, i) => {
      ctx.fillStyle = colors[state] ?? "";
      ctx.fillRect(
        (i % COLUMNS) * (cell + GAP),
        Math.floor(i / COLUMNS) * (cell + GAP),
        cell,
        cell,
      );
    });
  }, [transitions, t, papers, w, h, cell, theme]);

  return (
    <div ref={wrap} className="paper-grid">
      <canvas
        ref={canvas}
        style={{ width: w, height: h }}
        role="img"
        aria-label={`${papers.toLocaleString("en-US")} papers, one cell each, colored by the stage each is in; the counts are listed above.`}
      />
    </div>
  );
}
