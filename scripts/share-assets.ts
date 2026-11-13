// Draws the share image (public/og.png, 1200×630) and the PNG icons (public/favicon-32.png,
// public/apple-touch-icon.png) with headless Chromium, in the site's style: the dark palette,
// Inter and JetBrains Mono, and the same HNSW graph and search route as the home page. The PNGs
// are committed; run this again after changing the profile text or the icon.
//
// Usage: node scripts/share-assets.ts   (needs `npx playwright install chromium` once)

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import { profile } from "../src/content/profile.ts";
import { buildGraph, HOME_EF, HOME_GRAPH_OPTIONS, search } from "../src/pages/home/hnsw.ts";
import { layersLayout, planeOutline, project } from "../src/pages/home/layers.ts";

const root = resolve(import.meta.dirname, "..");
const pub = join(root, "public");
const work = join(root, "node_modules", ".cache", "share-assets");
const fonts = (path: string) => pathToFileURL(join(root, "node_modules", path)).href;

// The dark theme's tokens (src/styles/tokens.css).
const C = {
  bg: "#0d1117",
  surface: "#111721",
  border: "#30363d",
  text: "#e6edf3",
  text2: "#9da7b3",
  text3: "#7d8590",
  accent: "#e3b341",
};

const r2 = (v: number) => Math.round(v * 100) / 100;

/** The three-layer graph with one search route, as SVG markup. */
function graphSvg(): string {
  const graph = buildGraph(HOME_GRAPH_OPTIONS);
  const layout = layersLayout(graph.top + 1);
  const query = { x: 0.2, y: 0.78 };
  const trace = search(graph, query, HOME_EF);
  const parts: string[] = [];
  layout.planes.forEach((plane, layer) => {
    parts.push(`<path d="${planeOutline(plane)}" fill="${C.surface}" stroke="${C.border}"/>`);
    parts.push(
      `<text x="${plane.left + plane.width + plane.skew + 12}" y="${plane.top + plane.depth / 2 + 4}" fill="${C.text3}" font-size="12">L${layer}</text>`,
    );
    graph.links[layer]?.forEach((neighbors, i) => {
      for (const j of neighbors) {
        if (j < i && graph.links[layer]?.[j]?.includes(i)) continue;
        const a = project(graph.points[i] ?? query, plane);
        const b = project(graph.points[j] ?? query, plane);
        parts.push(
          `<line x1="${r2(a.x)}" y1="${r2(a.y)}" x2="${r2(b.x)}" y2="${r2(b.y)}" stroke="${C.border}" stroke-width="0.8"/>`,
        );
      }
    });
    graph.points.forEach((p, i) => {
      if ((graph.levels[i] ?? 0) < layer) return;
      const s = project(p, plane);
      parts.push(
        `<circle cx="${r2(s.x)}" cy="${r2(s.y)}" r="${layer === 0 ? 2.2 : 3}" fill="${C.text3}"/>`,
      );
    });
  });
  for (const { layer, path } of trace.layers) {
    const plane = layout.planes[layer];
    const below = layout.planes[layer - 1];
    if (!plane) continue;
    const pts = path.map((i) => project(graph.points[i] ?? query, plane));
    if (pts.length > 1) {
      parts.push(
        `<polyline points="${pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(" ")}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`,
      );
    }
    for (const p of pts) {
      parts.push(
        `<circle cx="${r2(p.x)}" cy="${r2(p.y)}" r="3.6" fill="${C.accent}" stroke="${C.bg}" stroke-width="1.5"/>`,
      );
    }
    const last = pts[pts.length - 1];
    const lastNode = path[path.length - 1];
    if (below && last && lastNode !== undefined) {
      const to = project(graph.points[lastNode] ?? query, below);
      parts.push(
        `<line x1="${r2(last.x)}" y1="${r2(last.y)}" x2="${r2(to.x)}" y2="${r2(to.y)}" stroke="${C.accent}" stroke-width="1.25" stroke-dasharray="3 3"/>`,
      );
    }
  }
  const plane0 = layout.planes[0];
  if (plane0) {
    const q = project(query, plane0);
    const res = project(graph.points[trace.result] ?? query, plane0);
    parts.push(
      `<circle cx="${r2(res.x)}" cy="${r2(res.y)}" r="7" fill="none" stroke="${C.accent}" stroke-width="1.5"/>`,
    );
    parts.push(
      `<circle cx="${r2(q.x)}" cy="${r2(q.y)}" r="4" fill="${C.text}" stroke="${C.bg}" stroke-width="2"/>`,
    );
    parts.push(
      `<text x="${r2(q.x + 8)}" y="${r2(q.y - 8)}" fill="${C.text}" font-size="13" font-weight="500">q</text>`,
    );
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.width} ${layout.height}" font-family="JetBrains Mono">${parts.join("")}</svg>`;
}

const escape = (s: string) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;");

const shareHtml = `<!doctype html>
<html><head><meta charset="utf-8"><style>
@font-face { font-family: "Inter"; src: url("${fonts("@fontsource-variable/inter/files/inter-latin-wght-normal.woff2")}") format("woff2"); font-weight: 100 900; }
@font-face { font-family: "JetBrains Mono"; src: url("${fonts("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2")}") format("woff2"); font-weight: 400; }
@font-face { font-family: "JetBrains Mono"; src: url("${fonts("@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2")}") format("woff2"); font-weight: 500; }
* { box-sizing: border-box; margin: 0; }
body { width: 1200px; height: 630px; overflow: hidden; background: ${C.bg};
  background-image: radial-gradient(900px 420px at 88% 0%, #e3b34122, transparent 70%);
  font-family: Inter; color: ${C.text2}; display: grid; grid-template-columns: 600px 1fr;
  align-items: center; padding: 0 64px 0 76px; gap: 24px; }
.kicker { font-family: "JetBrains Mono"; font-size: 19px; letter-spacing: 0.08em; color: ${C.accent}; text-transform: uppercase; }
h1 { margin-top: 18px; font-size: 92px; line-height: 1; letter-spacing: -0.035em; color: ${C.text}; font-weight: 700; }
.pitch { margin-top: 26px; font-size: 33px; line-height: 1.3; color: ${C.text}; }
.url { margin-top: 44px; font-family: "JetBrains Mono"; font-size: 19px; color: ${C.text3}; }
svg { width: 100%; height: auto; }
</style></head><body>
<div>
  <p class="kicker">${escape(profile.headline)}</p>
  <h1>${escape(profile.name)}</h1>
  <p class="pitch">${escape(profile.pitch)}</p>
  <p class="url">${escape(profile.siteUrl.replace(/^https:\/\//, "").replace(/\/$/, ""))}</p>
</div>
<div>${graphSvg()}</div>
</body></html>`;

const icon = await readFile(join(pub, "favicon.svg"), "utf8");
// The touch icon is full-bleed: iOS rounds the corners itself.
const touchIcon = icon.replace('rx="7"', 'rx="0"');
const iconHtml = (svg: string, size: number) =>
  `<!doctype html><html><body style="margin:0;background:transparent">` +
  svg.replace("<svg ", `<svg width="${size}" height="${size}" `) +
  `</body></html>`;

await mkdir(work, { recursive: true });
const browser = await chromium.launch();
try {
  const shots: {
    html: string;
    width: number;
    height: number;
    out: string;
    omitBackground: boolean;
  }[] = [
    { html: shareHtml, width: 1200, height: 630, out: "og.png", omitBackground: false },
    {
      html: iconHtml(icon, 32),
      width: 32,
      height: 32,
      out: "favicon-32.png",
      omitBackground: true,
    },
    {
      html: iconHtml(touchIcon, 180),
      width: 180,
      height: 180,
      out: "apple-touch-icon.png",
      omitBackground: false,
    },
  ];
  for (const shot of shots) {
    const file = join(work, `${shot.out}.html`);
    await writeFile(file, shot.html);
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height } });
    await page.goto(pathToFileURL(file).href);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: join(pub, shot.out), omitBackground: shot.omitBackground });
    await page.close();
  }
} finally {
  await browser.close();
  await rm(work, { recursive: true, force: true });
}
