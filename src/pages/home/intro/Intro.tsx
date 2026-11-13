import { useEffect, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { arrive, introMode, isAfter, rememberArrival } from "./arrive";
import type { Stage } from "./morph";
import { INTRO_SCREEN } from "./screen";
import "./intro.css";

// The home page's scroll intro. While the visitor scrolls the first four screens, the hero stays
// pinned and a particle field on its right becomes four of the projects in turn, then settles on
// the hero's HNSW graph and hands over to it. It plays once: at its end, or as soon as the
// visitor skips past it, it arrives (arrive.ts), and the hero stays as it left it.
//
// It only runs when index.html's head script has set data-intro on <html>: scripts run, the
// visitor has not asked for reduced motion and the window is large (screen.ts). That script also
// picks "play" or "arrived" and so sizes the stage before the first paint: nothing shifts.
// Otherwise (and in the prerendered HTML) these wrappers are plain blocks around today's hero. To
// remove the intro, revert the commits that added and changed this folder; README.md says how.

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

function subscribeMode(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-intro"] });
  return () => observer.disconnect();
}

/** Keys that jump down a page, unless the focus is somewhere they do something else. */
function isPageDown(event: KeyboardEvent): boolean {
  if (event.key === "PageDown") return true;
  if (event.key !== " " || event.shiftKey) return false;
  const target = event.target instanceof Element ? event.target : null;
  return !target?.closest("button, input, select, textarea, summary, [contenteditable], [role]");
}

export function Intro({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  // Null on the server and while hydrating, so the markup matches the prerendered page.
  const mode = useSyncExternalStore(subscribeMode, introMode, () => null);

  // Arriving from another page through a link to a section below (the header's links, a project
  // page's "back to work") skips the intro, before the first paint of the home page. On a first
  // load the head script has already decided.
  useLayoutEffect(() => {
    const element = root.current;
    if (element && introMode() === "play" && window.location.hash.length > 1) {
      arrive(element, false);
    }
  }, []);

  useEffect(() => {
    const element = root.current;
    if (mode === "arrived") rememberArrival();
    if (mode !== "play" || !element) return;

    // Skipping past the intro arrives first, so the jump lands on the collapsed page.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      // The intro's own links (Skip intro arrives in its onClick, so the router still sees the
      // click before React removes the link).
      if (!(link instanceof HTMLAnchorElement) || element.contains(link)) return;
      if (link.hash.length < 2) return;
      if (link.origin !== location.origin || link.pathname !== location.pathname) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (target && isAfter(element, target)) arrive(element);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey) return;
      const toEnd = event.key === "End" || (event.metaKey && event.key === "ArrowDown");
      let pastEnd = toEnd;
      if (!toEnd && isPageDown(event)) {
        // Arrive when this page step would carry the visitor past the end of the intro.
        const pin = element.querySelector<HTMLElement>(".intro-pin");
        const rect = element.getBoundingClientRect();
        const sticky = pin ? parseFloat(getComputedStyle(pin).top) || 0 : 0;
        const left = rect.top - sticky + rect.height - (pin?.offsetHeight ?? 0);
        pastEnd = left < window.innerHeight * 0.875;
      }
      if (pastEnd) arrive(element);
    };
    // Focus moving into the hero's search, or to anything below the intro (tabbing on).
    const focusMoved = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return;
      if (target.closest(".hero-figure") || isAfter(element, target)) arrive(element);
    };
    const onFocus = (event: FocusEvent) => focusMoved(event.target);
    document.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey);
    document.addEventListener("focusin", onFocus);
    // Focus may have got there before this ran.
    focusMoved(document.activeElement);
    // A window that becomes too small for the stage (a resize, a rotation, split screen) arrives
    // at once, rather than leave a squeezed stage; growing it again does not bring the intro back.
    const large = window.matchMedia(INTRO_SCREEN);
    const onResize = () => {
      if (!large.matches) arrive(element);
    };
    large.addEventListener("change", onResize);
    onResize();

    let stop: (() => void) | undefined;
    let cancelled = false;
    void import("./engine").then(({ startIntro }) => {
      if (!cancelled && introMode() === "play") stop = startIntro(element);
    });
    return () => {
      cancelled = true;
      stop?.();
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      large.removeEventListener("change", onResize);
    };
  }, [mode]);

  const playing = mode === "play";
  return (
    <div className="intro" ref={root} data-stage={mode === "arrived" ? "arrived" : undefined}>
      <div className="intro-pin">
        {playing && (
          <Link
            className="intro-skip"
            to={{ pathname: "/", hash: "#work" }}
            onClick={() => root.current && arrive(root.current)}
          >
            Skip intro
          </Link>
        )}
        {playing && <canvas className="intro-canvas" aria-hidden="true" />}
        {children}
        {playing && (
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
