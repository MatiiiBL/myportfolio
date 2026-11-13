import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Stage } from "./morph";
import "./intro.css";

// The home page's scroll intro. While the visitor scrolls the first four screens, the hero stays
// pinned and a particle field on its right becomes four of the projects in turn, then settles on
// the hero's HNSW graph and hands over to it.
//
// It only runs when index.html's head script has set data-intro on <html>: scripts run and the
// visitor has not asked for reduced motion. That script also makes the stage tall before the
// first paint, so nothing shifts. Otherwise (and in the prerendered HTML) these wrappers are
// plain blocks around today's hero. To remove the intro, revert the commit that added this
// folder; README.md says how.

const LABELS: { stage: Stage; kicker: string; to: string; text: string }[] = [
  {
    stage: "silicon",
    kicker: "RTL · Pulse",
    to: "/projects/pulse/",
    text: "The 8 × 8 systolic array. Operands enter skewed, so the multiply-accumulates sweep across it as a diagonal wavefront.",
  },
  {
    stage: "robots",
    kicker: "Robotics · Apex",
    to: "/projects/apex/",
    text: "The 186 cones of a simulated track, and the car's best lap on it (24.5 s), played four times faster.",
  },
  {
    stage: "models",
    kicker: "Inference · minillm",
    to: "/projects/minillm/",
    text: "Attention in layer 15, head 0: how much each of 13 tokens attends to the ones before it.",
  },
  {
    stage: "search",
    kicker: "Search · vecdex",
    to: "/projects/vecdex/",
    text: "The HNSW graph vecdex builds for 96 points. Keep scrolling to search it.",
  },
];

const noSubscription = () => () => {};
const introWanted = () => document.documentElement.hasAttribute("data-intro");

export function Intro({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  // False on the server and while hydrating, so the markup matches the prerendered page.
  const active = useSyncExternalStore(noSubscription, introWanted, () => false);

  useEffect(() => {
    const element = root.current;
    if (!active || !element) return;
    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("./engine").then(({ startIntro }) => {
      if (!cancelled) stop = startIntro(element);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [active]);

  return (
    <div className="intro" ref={root}>
      <div className="intro-pin">
        {active && (
          <a className="intro-skip" href="#work">
            Skip intro
          </a>
        )}
        {active && <canvas className="intro-canvas" aria-hidden="true" />}
        {children}
        {active && (
          <div className="intro-labels">
            {LABELS.map((label) => (
              <p key={label.stage} className="intro-label" data-intro-label={label.stage}>
                <Link to={label.to} className="intro-label-link">
                  {label.kicker}
                </Link>
                <span className="intro-label-text">{label.text}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
