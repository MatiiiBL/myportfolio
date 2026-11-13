// The intro plays once. When the visitor reaches its end, or skips past it, it "arrives": the
// pinned scroll space collapses and the hero stays as the intro left it (the interactive graph on
// the right), with no way back into the animation. The arrival is remembered for the browser
// session; the head script in index.html reads the same key and value before the first paint.

/** sessionStorage key and value for an intro that has arrived (index.html reads them too). */
export const ARRIVED_KEY = "intro";
export const ARRIVED = "arrived";

/** The intro's state on <html data-intro>: "play", "arrived", or null when it does not run. */
export type IntroMode = "play" | "arrived" | null;

export function introMode(): IntroMode {
  const mode = document.documentElement.getAttribute("data-intro");
  return mode === "play" || mode === ARRIVED ? mode : null;
}

export function rememberArrival(): void {
  try {
    sessionStorage.setItem(ARRIVED_KEY, ARRIVED);
  } catch {
    // Storage may be blocked; the intro then simply plays again on the next visit.
  }
}

/**
 * Arrives: collapses the pinned scroll space (intro.css) and, unless `inPlace` is false, scrolls
 * by exactly the height that went away, in the same frame, so the stage and everything below it
 * stay where they are on screen. Scroll anchoring is off while this happens, so the browser does
 * not add its own correction to ours.
 */
export function arrive(root: HTMLElement, inPlace = true): void {
  const html = document.documentElement;
  if (introMode() !== "play") return;
  const pin = root.querySelector<HTMLElement>(".intro-pin") ?? root;
  const before = pin.getBoundingClientRect().top;
  const { body } = document;
  html.style.overflowAnchor = "none";
  body.style.overflowAnchor = "none";

  html.setAttribute("data-intro", ARRIVED);
  root.dataset.stage = ARRIVED;
  // The engine may have left the hero's search half faded in; intro.css shows it from here on.
  const figure = root.querySelector<HTMLElement>(".hero-figure");
  figure?.style.removeProperty("opacity");
  figure?.style.removeProperty("pointer-events");

  if (inPlace) {
    // Reading the position lays the page out again, collapsed.
    const shift = pin.getBoundingClientRect().top - before;
    if (shift !== 0) window.scrollBy({ top: shift, left: 0, behavior: "instant" });
  }
  rememberArrival();

  // Anchoring comes back once the collapsed page has been painted.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      html.style.removeProperty("overflow-anchor");
      body.style.removeProperty("overflow-anchor");
    }),
  );
}

/** Whether `element` comes after the intro in the page (not inside it). */
export function isAfter(root: HTMLElement, element: Node): boolean {
  const position = root.compareDocumentPosition(element);
  return (
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0 &&
    (position & Node.DOCUMENT_POSITION_CONTAINED_BY) === 0
  );
}
