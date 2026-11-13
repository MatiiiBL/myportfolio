// Renders every route to static HTML after the client build (npm run build), so deep links load
// with status 200 on GitHub Pages and crawlers and link previews see the content without
// running JavaScript. The client then hydrates the markup.
//
// Input: dist/ (the client build, with its manifest) and dist-ssr/entry-server.js (the server
// build of src/entry-server.tsx). Output: dist/index.html, dist/projects/<slug>/index.html,
// dist/404.html and dist/sitemap.xml, each page with its own title, description, canonical
// link, Open Graph and Twitter tags, plus the styles its lazy page needs.

import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { RouteMeta } from "../src/pages/meta.ts";
import type { Experience, Profile, Project } from "../src/content/types.ts";

interface ServerEntry {
  render(path: string): Promise<string>;
  metaFor(pathname: string): RouteMeta;
  notFoundMeta: RouteMeta;
  routePaths: string[];
  absoluteUrl(path: string): string;
  profile: Profile;
  experience: Experience[];
  projects: Project[];
}

interface ManifestChunk {
  file: string;
  css?: string[];
  imports?: string[];
}

const root = resolve(import.meta.dirname, "..");
const dist = join(root, "dist");
const ssrDir = join(root, "dist-ssr");
const BASE = "/myportfolio/";

const server = (await import(pathToFileURL(join(ssrDir, "entry-server.js")).href)) as ServerEntry;
const template = await readFile(join(dist, "index.html"), "utf8");
const manifest = JSON.parse(await readFile(join(dist, ".vite", "manifest.json"), "utf8")) as Record<
  string,
  ManifestChunk
>;
const assets = await readdir(join(dist, "assets"));

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

/** The styles a manifest chunk needs: its own and those of its static imports. */
function chunkStyles(key: string, seen = new Set<string>()): string[] {
  const chunk = manifest[key];
  if (!chunk || seen.has(key)) return [];
  seen.add(key);
  return [...(chunk.css ?? []), ...(chunk.imports ?? []).flatMap((dep) => chunkStyles(dep, seen))];
}

const entryStyles = chunkStyles("index.html");

/** The lazy chunk that holds a route's page: the home page or a project page body. */
function routeChunk(path: string): string | null {
  if (path === "/") return "src/pages/Home.tsx";
  const slug = /^\/projects\/([^/]+)\/$/.exec(path)?.[1];
  return slug ? `src/projects/${slug}/Page.tsx` : null;
}

/**
 * The styles of a route's lazy chunk, which its prerendered body needs from the first paint.
 * They are a few kilobytes, so they are inlined: the shared stylesheet, cached across pages,
 * stays the only request that holds up the first paint (Lighthouse measured each extra one at
 * 150-300 ms on its phone network). Each inlined file also gets a disabled <link>: browsers do
 * not download a disabled stylesheet, and Vite's loader sees the link and does not fetch the
 * file again when the chunk loads.
 *
 * The chunk's scripts are not preloaded either: the body is already in the HTML, and preloading
 * them delayed the largest paint on a phone network (2.8 s against 2.4 s on Pulse).
 */
function routeAssets(path: string): string[] {
  const chunk = routeChunk(path);
  if (!chunk) return [];
  return chunkStyles(chunk)
    .filter((file) => !entryStyles.includes(file))
    .flatMap((file) => [
      `<style>${stylesheet(file)}</style>`,
      `<link rel="stylesheet" crossorigin href="${BASE}${file}" disabled>`,
    ]);
}

function stylesheet(file: string): string {
  const css = stylesheets.get(file);
  if (css === undefined) throw new Error(`The manifest names ${file}, which is not in dist/`);
  return css;
}

// Every emitted stylesheet by its path in the manifest. Their url()s are absolute, so the CSS
// works inlined in any page.
const stylesheets = new Map<string, string>(
  await Promise.all(
    assets
      .filter((name) => name.endsWith(".css"))
      .map(async (name) => {
        const css = await readFile(join(dist, "assets", name), "utf8");
        return [`assets/${name}`, css.replaceAll("</style", "<\\/style")] as [string, string];
      }),
  ),
);

/** The text faces used above the fold, preloaded so the first paint uses them. */
const fontPreloads = [
  /^inter-latin-wght-normal-[\w-]+\.woff2$/,
  /^jetbrains-mono-latin-400-normal-[\w-]+\.woff2$/,
]
  .map((pattern) => assets.find((name) => pattern.test(name)))
  .filter((name): name is string => name !== undefined)
  .map(
    (name) =>
      `<link rel="preload" href="${BASE}assets/${name}" as="font" type="font/woff2" crossorigin>`,
  );

function personJsonLd(): string {
  const { profile } = server;
  const data = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    url: profile.siteUrl,
    email: `mailto:${profile.email}`,
    description: profile.pitch,
    jobTitle: profile.status,
    affiliation: {
      "@type": "CollegeOrUniversity",
      name: profile.education.school.split(",")[0],
    },
    address: { "@type": "PostalAddress", addressLocality: profile.location },
    knowsLanguage: profile.languages.map((l) => l.name),
    sameAs: [profile.links.github, profile.links.linkedin],
  };
  return `<script type="application/ld+json">${JSON.stringify(data).replaceAll("<", "\\u003c")}</script>`;
}

/**
 * The share image of a route and its text alternative: a project page's own card (drawn by
 * scripts/share-assets.ts), and the home page's for every other route.
 */
function shareImage(path: string | null): { url: string; alt: string } {
  const project = server.projects.find((p) => path === `/projects/${p.slug}/`);
  if (!project) {
    return {
      url: server.absoluteUrl("/og.png"),
      alt: `${server.profile.name}: ${server.profile.pitch}`,
    };
  }
  const stats = project.stats.map((s) => `${s.value} ${s.label}`).join("; ");
  return {
    url: server.absoluteUrl(`/og/${project.slug}.png`),
    alt: `${project.name}: ${project.tagline} ${stats}.`,
  };
}

function headTags(meta: RouteMeta, path: string | null): string {
  const url = meta.path ? server.absoluteUrl(meta.path) : null;
  const { url: image, alt: imageAlt } = shareImage(path);
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  return [
    url ? `<link rel="canonical" href="${url}">` : `<meta name="robots" content="noindex">`,
    `<meta property="og:type" content="${meta.type}">`,
    `<meta property="og:site_name" content="${escapeHtml(server.profile.name)}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    ...(url ? [`<meta property="og:url" content="${url}">`] : []),
    `<meta property="og:image" content="${image}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
    `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}">`,
    ...fontPreloads,
    ...(path ? routeAssets(path) : []),
    ...(path === "/" ? [personJsonLd()] : []),
  ].join("\n    ");
}

function page(meta: RouteMeta, path: string | null, html: string): string {
  const titleTag = /<title>[^<]*<\/title>/;
  const descriptionTag = /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/;
  if (
    !titleTag.test(template) ||
    !descriptionTag.test(template) ||
    !template.includes("<!--app-html-->")
  ) {
    throw new Error("dist/index.html is missing the title, description or app placeholders");
  }
  return template
    .replace(titleTag, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(
      descriptionTag,
      `<meta name="description" content="${escapeHtml(meta.description)}" />`,
    )
    .replace("<!--app-head-->", headTags(meta, path))
    .replace("<!--app-html-->", html);
}

/** Guards against shipping a page whose lazy body did not render. */
function check(path: string, html: string): void {
  const project = server.projects.find((p) => path === `/projects/${p.slug}/`);
  const expected = project
    ? ['class="project-name"', 'class="section"']
    : path === "/"
      ? ['id="hero-name"', 'id="work"']
      : ["not-found"];
  for (const marker of expected) {
    if (!html.includes(marker)) throw new Error(`Prerendered ${path} is missing ${marker}`);
  }
}

async function write(file: string, contents: string): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, contents);
}

for (const path of server.routePaths) {
  const html = await server.render(path);
  check(path, html);
  const file = path === "/" ? join(dist, "index.html") : join(dist, path, "index.html");
  await write(file, page(server.metaFor(path), path, html));
}

const notFound = await server.render("/404/");
check("/404/", notFound);
await write(join(dist, "404.html"), page(server.notFoundMeta, null, notFound));

const sitemap = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...server.routePaths.map((p) => `  <url><loc>${server.absoluteUrl(p)}</loc></url>`),
  "</urlset>",
  "",
].join("\n");
await write(join(dist, "sitemap.xml"), sitemap);

// The manifest and the server bundle were only needed to build the pages.
await rm(join(dist, ".vite"), { recursive: true, force: true });
await rm(ssrDir, { recursive: true, force: true });

process.stdout.write(`Prerendered ${server.routePaths.length + 1} pages and sitemap.xml\n`);
