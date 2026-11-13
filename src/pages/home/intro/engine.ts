import { mulberry32 } from "../../../lib/hnsw/points";
import { arrive, introMode } from "./arrive";
import apexTrack from "./data/apex-track.json";
import attention from "./data/attention.json";
import {
  ARRAY_SIZE,
  COLOR,
  MOTION,
  PALETTE_SIZE,
  attentionFormation,
  parseNodes,
  parseOutline,
  parseSegments,
  placeCar,
  placeLanes,
  searchFormation,
  siliconFormation,
  trackFormation,
  waveIntensity,
  type Formation,
  type Point,
  type SearchScene,
} from "./formations";
import {
  bump,
  clamp01,
  easeInOutCubic,
  flightPoint,
  handoverAt,
  phaseAt,
  stageAt,
  stagger,
  type Flight,
  type Stage,
} from "./morph";

// The intro's particle field: one canvas behind the hero's text, drawn with requestAnimationFrame
// from the scroll position. React renders the markup once; everything per frame happens here, on
// typed arrays allocated up front.

/** The design tokens behind the palette slots, in the order of COLOR. */
const TOKENS = [
  "--text-3",
  "--accent",
  "--series-1",
  "--series-2",
  "--series-3",
  "--border",
  "--text",
];
/** The particles in the field (the intro only plays in large windows: screen.ts), and their radius. */
const PARTICLES = 1200;
const RADIUS = 1.6;
/** Color blend steps and opacity levels particles are drawn in: the batches of a frame. */
const MIX_STEPS = 4;
const ALPHA_LEVELS = 10;
const BATCHES = PALETTE_SIZE * PALETTE_SIZE * MIX_STEPS * ALPHA_LEVELS;
/** The share of a flight particles may wait before leaving, so a formation dissolves in a wave. */
const SPREAD = 0.45;
/** How fast the drawn progress follows the scroll, per second, to smooth out wheel steps. */
const FOLLOW = 14;
/** A moving particle's streak: this many frames of its motion, and never longer (pixels). */
const STREAK = 2.5;
const MAX_STREAK = 48;
/** How far each formation leans toward the hero's isometric planes (0 flat, 1 as steep). */
const LEAN = [0.35, 0.55, 0.12];

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fits content of the given aspect into a box, centered. */
function fit(box: Box, aspect: number): Box {
  const w = Math.min(box.w, box.h * aspect);
  const h = w / aspect;
  return { x: box.x + (box.w - w) / 2, y: box.y + (box.h - h) / 2, w, h };
}

/** Starts the intro on its root element; returns the function that stops it. */
export function startIntro(root: HTMLElement): () => void {
  const pinEl = root.querySelector<HTMLElement>(".intro-pin");
  const canvasEl = root.querySelector<HTMLCanvasElement>(".intro-canvas");
  const svgEl = root.querySelector<SVGSVGElement>(".hnsw-svg");
  const figureEl = root.querySelector<HTMLElement>(".hero-figure");
  const context = canvasEl?.getContext("2d");
  if (!pinEl || !canvasEl || !svgEl || !figureEl || !context) return () => {};
  const pin: HTMLElement = pinEl;
  const canvas: HTMLCanvasElement = canvasEl;
  const svg: SVGSVGElement = svgEl;
  const figure: HTMLElement = figureEl;
  const ctx: CanvasRenderingContext2D = context;
  const labels = [...root.querySelectorAll<HTMLElement>("[data-intro-label]")];

  const count = PARTICLES;
  const silicon = siliconFormation(count);
  const track = trackFormation(count, { cones: apexTrack.cones, lap: apexTrack.lap8 });
  const formations: Formation[] = [
    silicon,
    track,
    attentionFormation(count, attention.weights),
    searchFormation(count, { nodes: [], edges: [], outlines: [], route: [], stops: [] }),
  ];

  // Each particle's own character: depth, when it leaves, how its path bows and turns.
  const random = mulberry32(2026);
  const depth = new Float32Array(count);
  const jitter = new Float32Array(count);
  const arc = new Float32Array(count);
  const swirl = new Float32Array(count);
  const delay = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    depth[i] = random();
    jitter[i] = random();
    // Every particle bows and turns the same way in a given flight, by its own amount: the field
    // moves as one vortex rather than a cloud of independent sparks.
    arc[i] = 0.12 + 0.3 * random();
    swirl[i] = 0.35 + 0.8 * random();
  }

  // Screen positions of every formation's particles, in stage pixels, and the order each
  // formation's particles are visited in: particle i flies to the i-th from the left of the next
  // formation, so the field flows across instead of crossing itself.
  const screenX = formations.map(() => new Float32Array(count));
  const screenY = formations.map(() => new Float32Array(count));
  const order = formations.map(() => new Uint16Array(count));
  const boxes: Box[] = formations.map(() => ({ x: 0, y: 0, w: 0, h: 0 }));
  let width = 0;
  let height = 0;
  let dpr = 1;
  let centerX = 0;
  let centerY = 0;
  let dirty = true;

  /** Maps formation f's unit square into its box, leaning like the hero's planes. */
  const toScreen = (f: number, u: number, v: number, out: Point): void => {
    const box = boxes[f];
    const lean = LEAN[f] ?? 0;
    if (!box) return;
    out.x = box.x + u * box.w * (1 - lean * 0.19) + (1 - v) * box.w * lean * 0.19;
    out.y = box.y + box.h * (lean * 0.15 + v * (1 - lean * 0.3));
  };

  const placed = { x: 0, y: 0 };
  const placeFormation = (f: number, onlyMoving: boolean): void => {
    const form = formations[f];
    const xs = screenX[f];
    const ys = screenY[f];
    if (!form || !xs || !ys) return;
    for (let i = 0; i < count; i++) {
      if (onlyMoving && form.motion[i] === MOTION.none) continue;
      if (f === 3) {
        xs[i] = form.x[i] ?? 0;
        ys[i] = form.y[i] ?? 0;
      } else {
        toScreen(f, form.x[i] ?? 0, form.y[i] ?? 0, placed);
        xs[i] = placed.x;
        ys[i] = placed.y;
      }
    }
  };

  /** The hero's drawing, read from its SVG and mapped to stage pixels with its live transform. */
  const readScene = (stage: DOMRect): SearchScene => {
    const matrix = svg.getScreenCTM();
    const toStage = (p: Point): Point => {
      if (!matrix) return p;
      const q = new DOMPoint(p.x, p.y).matrixTransform(matrix);
      return { x: q.x - stage.left, y: q.y - stage.top };
    };
    const number = (el: Element, name: string) => Number(el.getAttribute(name) ?? 0);
    const scene: SearchScene = { nodes: [], edges: [], outlines: [], route: [], stops: [] };
    svg.querySelectorAll(".hnsw-node").forEach((path, layer, all) => {
      for (const n of parseNodes(path.getAttribute("d") ?? "")) {
        scene.nodes.push({ ...toStage(n), upper: layer < all.length - 1 });
      }
    });
    svg.querySelectorAll(".hnsw-edge").forEach((path) => {
      for (const [a, b] of parseSegments(path.getAttribute("d") ?? "")) {
        scene.edges.push([toStage(a), toStage(b)]);
      }
    });
    svg.querySelectorAll(".hnsw-plane").forEach((path) => {
      for (const [a, b] of parseOutline(path.getAttribute("d") ?? "")) {
        scene.outlines.push([toStage(a), toStage(b)]);
      }
    });
    svg.querySelectorAll(".hnsw-route .hnsw-hop, .hnsw-route .hnsw-drop").forEach((line) => {
      scene.route.push([
        toStage({ x: number(line, "x1"), y: number(line, "y1") }),
        toStage({ x: number(line, "x2"), y: number(line, "y2") }),
      ]);
    });
    svg.querySelectorAll(".hnsw-route .hnsw-stop").forEach((dot) => {
      scene.stops.push(toStage({ x: number(dot, "cx"), y: number(dot, "cy") }));
    });
    return scene;
  };

  const layout = (): void => {
    const stage = pin.getBoundingClientRect();
    width = stage.width;
    height = stage.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    // The formations take the place of the hero's drawing, kept inside the visible stage.
    const art = svg.getBoundingClientRect();
    const top = art.top - stage.top;
    const visibleBottom = Math.min(stage.bottom, window.innerHeight) - stage.top - 72;
    const box: Box = {
      x: art.left - stage.left,
      y: top,
      w: art.width,
      h: Math.max(80, Math.min(art.height, visibleBottom - top)),
    };
    centerX = box.x + box.w / 2;
    centerY = box.y + box.h / 2;
    formations.forEach((form, f) => {
      if (f < 3) boxes[f] = fit(box, form.aspect);
    });
    formations[3] = searchFormation(count, readScene(stage));
    formations.forEach((form, f) => {
      placeFormation(f, false);
      const xs = screenX[f];
      const o = order[f];
      if (!xs || !o) return;
      const idx = Array.from({ length: form.count }, (_, i) => i);
      idx.sort((a, b) => (xs[a] ?? 0) - (xs[b] ?? 0) || a - b);
      idx.forEach((v, i) => (o[i] = v));
    });
    // Leave left to right, with some scatter.
    for (let i = 0; i < count; i++) delay[i] = 0.7 * (i / count) + 0.3 * (jitter[i] ?? 0);
    root.style.setProperty("--intro-art-left", `${box.x}px`);
    root.style.setProperty("--intro-art-top", `${box.y + box.h + 12}px`);
    root.style.setProperty("--intro-art-width", `${box.w}px`);
    dirty = true;
  };

  // The palette, read from the tokens, as the fill string of every blend step and opacity.
  let fills: string[] = [];
  let additive = false;
  const readPalette = (): void => {
    const style = getComputedStyle(document.documentElement);
    const rgb = TOKENS.map((token) => parseColor(style.getPropertyValue(token)));
    const bg = parseColor(style.getPropertyValue("--bg"));
    // Light adds up on a dark page; on a light one it would wash out, so particles cover.
    additive = (bg[0] + bg[1] + bg[2]) / 3 < 128;
    fills = [];
    for (let a = 0; a < PALETTE_SIZE; a++) {
      for (let b = 0; b < PALETTE_SIZE; b++) {
        for (let s = 0; s < MIX_STEPS; s++) {
          const t = s / (MIX_STEPS - 1);
          const ca = rgb[a] ?? [0, 0, 0];
          const cb = rgb[b] ?? [0, 0, 0];
          const mix = [0, 1, 2].map((k) => Math.round((ca[k] ?? 0) * (1 - t) + (cb[k] ?? 0) * t));
          for (let l = 0; l < ALPHA_LEVELS; l++) {
            const alpha = ((l + 1) / ALPHA_LEVELS).toFixed(2);
            fills.push(`rgba(${mix[0]},${mix[1]},${mix[2]},${alpha})`);
          }
        }
      }
    }
    dirty = true;
  };

  // Per-frame scratch, allocated once.
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pr = new Float32Array(count);
  const batch = new Int32Array(count);
  const starts = new Int32Array(BATCHES + 1);
  const cursor = new Int32Array(BATCHES + 1);
  const sorted = new Uint16Array(count);
  const point = { x: 0, y: 0 };
  const flight: Flight = { ax: 0, ay: 0, bx: 0, by: 0, arc: 0, swirl: 0, cx: 0, cy: 0 };
  const lookA = { color: 0, alpha: 0 };
  const lookB = { color: 0, alpha: 0 };

  /** A particle's color slot and opacity in formation f, with its motion at rest applied. */
  const look = (f: number, j: number, seconds: number, out: { color: number; alpha: number }) => {
    const form = formations[f];
    out.color = form?.color[j] ?? 0;
    out.alpha = form?.alpha[j] ?? 0;
    if (form?.motion[j] === MOTION.cell) {
      const cell = form.slot[j] ?? 0;
      const glow = waveIntensity(Math.floor(cell / ARRAY_SIZE), cell % ARRAY_SIZE, seconds);
      if (glow > 0.35) out.color = COLOR.accent;
      out.alpha = Math.min(1, out.alpha * (0.6 + 0.9 * glow));
    }
  };

  let progress = -1;
  let stage: Stage | null = null;
  let handover = -1;
  let last = 0;
  // Whether the last frame drew streaks, so the next one must be drawn even if nothing moves; and
  // whether the positions in px and py are last frame's (not after a resize or the first frame).
  let streaked = false;
  let fresh = true;
  // Whether the visitor has scrolled to the end. From then on the intro only goes forward:
  // scrolling back up while its last frames play does not rewind it.
  let ended = false;
  const streakX = new Float32Array(count);
  const streakY = new Float32Array(count);

  const scrollProgress = (): number => {
    const rect = root.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    const range = rect.height - pin.offsetHeight;
    return range > 0 ? clamp01((top - rect.top) / range) : 0;
  };
  /** Whether the page is scrolled to the end of the intro or beyond (to the pixel). */
  const atEnd = (): boolean => {
    const rect = root.getBoundingClientRect();
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    return rect.top + rect.height - pin.offsetHeight <= top + 1;
  };

  const draw = (now: number): void => {
    // Arrived, here or by a skip (Intro.tsx): nothing more to draw, and the loop is being stopped.
    if (introMode() !== "play") return;
    const seconds = now / 1000;
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1;
    last = now;
    if (atEnd()) ended = true;
    const target = ended ? 1 : scrollProgress();
    progress =
      progress < 0 ? target : progress + (target - progress) * (1 - Math.exp(-FOLLOW * dt));
    if (Math.abs(target - progress) < 1e-4) progress = target;
    // The graph has formed and the hero's search is fully shown (the particles faded out on the
    // frame before): the intro has arrived.
    if (ended && progress === 1) {
      arrive(root);
      return;
    }

    const phase = phaseAt(progress);
    const h = handoverAt(progress);
    // Silicon and the track move at rest; the other formations only change when scrolled.
    const moving = phase.from <= 1 || phase.to <= 1 || progress !== target;
    if (!moving && !dirty && !streaked && h === handover) return;
    if (dirty) fresh = true;
    dirty = false;

    if (phase.from === 0 || phase.to === 0) {
      placeLanes(silicon, seconds);
      placeFormation(0, true);
    }
    if (phase.from === 1 || phase.to === 1) {
      placeCar(track, seconds);
      placeFormation(1, true);
    }

    const fromOrder = order[phase.from];
    const toOrder = order[phase.to];
    const ax = screenX[phase.from];
    const ay = screenY[phase.from];
    const bx = screenX[phase.to];
    const by = screenY[phase.to];
    const formA = formations[phase.from];
    const formB = formations[phase.to];
    if (!fromOrder || !toOrder || !ax || !ay || !bx || !by || !formA || !formB) return;
    const fade = 1 - h;
    const flying = phase.from !== phase.to;
    // Alternate the vortex's direction from one flight to the next.
    const turn = phase.from % 2 === 0 ? 1 : -1;
    starts.fill(0);
    for (let i = 0; i < count; i++) {
      const a = fromOrder[i] ?? 0;
      const b = toOrder[i] ?? 0;
      const e = flying ? easeInOutCubic(stagger(phase.t, delay[i] ?? 0, SPREAD)) : 0;
      const z = depth[i] ?? 0.5;
      flight.ax = ax[a] ?? 0;
      flight.ay = ay[a] ?? 0;
      flight.bx = bx[b] ?? 0;
      flight.by = by[b] ?? 0;
      flight.arc = (arc[i] ?? 0) * turn;
      // Nearer particles turn further, which reads as depth in the vortex.
      flight.swirl = (swirl[i] ?? 0) * turn * (0.6 + 0.8 * z);
      flight.cx = centerX;
      flight.cy = centerY;
      flightPoint(flight, e, point);
      // Depth: nearer particles are larger and brighter, and rise further while in flight.
      const lift = bump(e) * (z - 0.5) * 60;
      const x = point.x + lift * 0.4;
      const y = point.y - lift;
      // How far the particle moved since the last frame, for its streak. An operand resting in its
      // lane jumps back to the lane's start when it reaches the array: no streak for that.
      const jump =
        (e === 0 && formA.motion[a] === MOTION.lane) ||
        (e === 1 && formB.motion[b] === MOTION.lane);
      streakX[i] = fresh || jump ? 0 : x - (px[i] ?? x);
      streakY[i] = fresh || jump ? 0 : y - (py[i] ?? y);
      px[i] = x;
      py[i] = y;
      look(phase.from, a, seconds, lookA);
      look(phase.to, b, seconds, lookB);
      const sizeA = formA.size[a] ?? 1;
      const sizeB = formB.size[b] ?? 1;
      const r = RADIUS * (sizeA + (sizeB - sizeA) * e) * (0.65 + 0.7 * z) * (1 + bump(e) * 0.5);
      pr[i] = r;
      const alpha = (lookA.alpha + (lookB.alpha - lookA.alpha) * e) * (0.55 + 0.45 * z) * fade;
      const level = Math.min(ALPHA_LEVELS, Math.round(alpha * ALPHA_LEVELS)) - 1;
      if (level < 0 || r <= 0) {
        batch[i] = -1;
        continue;
      }
      const step = Math.round(e * (MIX_STEPS - 1));
      const k =
        ((lookA.color * PALETTE_SIZE + lookB.color) * MIX_STEPS + step) * ALPHA_LEVELS + level;
      batch[i] = k;
      starts[k + 1] = (starts[k + 1] ?? 0) + 1;
    }
    fresh = false;
    // A counting sort by batch, so each fill is set once per frame.
    for (let k = 0; k < BATCHES; k++) starts[k + 1] = (starts[k + 1] ?? 0) + (starts[k] ?? 0);
    cursor.set(starts);
    for (let i = 0; i < count; i++) {
      const k = batch[i] ?? -1;
      if (k < 0) continue;
      const at = cursor[k] ?? 0;
      sorted[at] = i;
      cursor[k] = at + 1;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = additive ? "lighter" : "source-over";
    ctx.lineCap = "round";
    ctx.lineWidth = RADIUS * 1.2;
    streaked = false;
    for (let k = 0; k < BATCHES; k++) {
      const begin = starts[k] ?? 0;
      const end = starts[k + 1] ?? 0;
      if (begin === end) continue;
      const fill = fills[k] ?? "transparent";
      // A moving particle trails a streak back along its path: a few frames' worth of motion.
      let streaks = false;
      ctx.beginPath();
      for (let s = begin; s < end; s++) {
        const i = sorted[s] ?? 0;
        const dx = streakX[i] ?? 0;
        const dy = streakY[i] ?? 0;
        const step = Math.hypot(dx, dy);
        if (step < 0.75) continue;
        const reach = Math.min(STREAK, MAX_STREAK / step);
        const x = px[i] ?? 0;
        const y = py[i] ?? 0;
        ctx.moveTo(x - dx * reach, y - dy * reach);
        ctx.lineTo(x, y);
        streaks = true;
      }
      if (streaks) {
        ctx.strokeStyle = fill;
        ctx.stroke();
        streaked = true;
      }
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (let s = begin; s < end; s++) {
        const i = sorted[s] ?? 0;
        const x = px[i] ?? 0;
        const y = py[i] ?? 0;
        const r = pr[i] ?? 0;
        ctx.moveTo(x + r, y);
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }

    const current = stageAt(progress);
    if (current !== stage || h !== handover) {
      stage = current;
      handover = h;
      root.dataset.stage = current;
      // The label of the formation in view, until the hero's own caption takes over.
      for (const label of labels) {
        label.classList.toggle("is-active", label.dataset.introLabel === current && h < 0.5);
      }
      // Inline values, over intro.css's hidden starting state.
      figure.style.opacity = String(h);
      figure.style.pointerEvents = h >= 0.999 ? "auto" : "none";
    }
  };

  // The loop runs only while the stage is on screen.
  let frame = 0;
  let running = false;
  const tick = (now: number) => {
    draw(now);
    frame = running ? requestAnimationFrame(tick) : 0;
  };
  const start = () => {
    if (running) return;
    running = true;
    last = 0;
    fresh = true;
    frame = requestAnimationFrame(tick);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
  };
  const visibility = new IntersectionObserver(([entry]) => {
    if (entry?.isIntersecting) {
      start();
      return;
    }
    stop();
    // The visitor jumped past the end (a scrollbar drag, find in page): arrive now, out of sight.
    if (ended || atEnd()) arrive(root);
  });
  visibility.observe(root);

  const resize = new ResizeObserver(() => layout());
  resize.observe(pin);
  resize.observe(svg);
  const theme = new MutationObserver(readPalette);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const scheme = window.matchMedia("(prefers-color-scheme: dark)");
  scheme.addEventListener("change", readPalette);

  readPalette();
  layout();
  canvas.classList.add("is-ready");

  return () => {
    stop();
    visibility.disconnect();
    resize.disconnect();
    theme.disconnect();
    scheme.removeEventListener("change", readPalette);
    figure.style.opacity = "";
    figure.style.pointerEvents = "";
    canvas.classList.remove("is-ready");
    if (root.dataset.stage !== "arrived") delete root.dataset.stage;
  };
}

/** A "#rrggbb", "#rrggbbaa" or "rgb(...)" token value as [r, g, b]. */
export function parseColor(value: string): [number, number, number] {
  const v = value.trim();
  const hex = /^#([0-9a-f]{6})/i.exec(v)?.[1];
  if (hex) {
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ];
  }
  const nums = v.match(/[\d.]+/g)?.map(Number) ?? [];
  return [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0];
}
