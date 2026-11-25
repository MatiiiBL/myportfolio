// Holds the home page to the quality bar's JavaScript budget (docs/site.md, section 7): under
// 120 kB gzipped. Runs in npm run build after the client build, while dist/ still has Vite's
// manifest (scripts/prerender.ts removes it), and fails the build when the home page is over.
//
// It counts every script the home page can load: the entry chunk, the home page's lazy chunk,
// the chunks they import, and the chunks the home page loads on demand (the scroll intro's
// engine, which large windows load). It leaves out the project pages, which the entry only
// imports when the visitor opens one. Sizes are gzip at zlib's default level, as
// scripts/serve.ts sends them; GitHub Pages sent the entry chunk 0.9% larger when measured.
//
// Usage: node scripts/budget.ts (after vite build)

import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_KB = 120;
const HOME_CHUNK = "src/pages/Home.tsx";

interface ManifestChunk {
  file: string;
  imports?: string[];
  dynamicImports?: string[];
}

const dist = resolve(import.meta.dirname, "..", "dist");
const manifest = JSON.parse(await readFile(join(dist, ".vite", "manifest.json"), "utf8")) as Record<
  string,
  ManifestChunk
>;

function chunk(key: string): ManifestChunk {
  const found = manifest[key];
  if (!found) throw new Error(`budget: the manifest has no ${key}; update scripts/budget.ts`);
  return found;
}

/** Adds a chunk and the chunks it imports to `into`, following dynamic imports when asked. */
function collect(key: string, dynamic: boolean, into: Set<string>): Set<string> {
  if (into.has(key)) return into;
  into.add(key);
  const { imports = [], dynamicImports = [] } = chunk(key);
  for (const dep of imports) collect(dep, dynamic, into);
  if (dynamic) for (const dep of dynamicImports) collect(dep, dynamic, into);
  return into;
}

// The entry goes first and without its dynamic imports (the project pages), so that when the
// home page's chunk reaches it again through a static import it is not expanded a second time.
const keys = collect(HOME_CHUNK, true, collect("index.html", false, new Set()));
const rows = await Promise.all(
  [...keys].map(async (key) => {
    const file = chunk(key).file;
    const bytes = await readFile(join(dist, file));
    return { file, raw: bytes.length, gzip: gzipSync(bytes).length };
  }),
);
rows.sort((a, b) => b.gzip - a.gzip);

const kB = (bytes: number) => (bytes / 1000).toFixed(2).padStart(7);
const total = rows.reduce((sum, r) => sum + r.gzip, 0);
const lines = rows.map((r) => `  ${kB(r.gzip)} kB gzip  ${kB(r.raw)} kB  ${r.file}`);
process.stdout.write(
  `Home page JavaScript: ${(total / 1000).toFixed(2)} kB gzipped of ${BUDGET_KB} kB\n` +
    `${lines.join("\n")}\n`,
);
if (total > BUDGET_KB * 1000) {
  process.stderr.write(`The home page's JavaScript is over its ${BUDGET_KB} kB budget.\n`);
  process.exit(1);
}
