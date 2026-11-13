// Serves dist/ the way GitHub Pages serves the gh-pages branch, so the end-to-end tests and
// Lighthouse see what visitors get: the site under /myportfolio/, a directory's index.html at
// its path with a trailing slash (a 301 adds the slash), and 404.html with status 404 for
// anything else. `vite preview` would answer unknown paths with index.html and status 200.
//
// Usage: node scripts/serve.ts [--port 4173]

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const BASE = "/myportfolio/";
const dist = resolve(import.meta.dirname, "..", "dist");
const portFlag = process.argv.indexOf("--port");
const port = portFlag > 0 ? Number(process.argv[portFlag + 1]) : 4173;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
};

async function fileAt(path: string): Promise<"file" | "dir" | null> {
  try {
    const s = await stat(path);
    return s.isDirectory() ? "dir" : "file";
  } catch {
    return null;
  }
}

createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const send = (status: number, file: string) => {
    res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(res);
  };
  const notFound = () => send(404, join(dist, "404.html"));

  if (url.pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE });
    res.end();
    return;
  }
  if (!url.pathname.startsWith(BASE)) return notFound();

  const relative = normalize(decodeURIComponent(url.pathname.slice(BASE.length)));
  if (relative.startsWith("..")) return notFound();
  const target = join(dist, relative);

  void fileAt(target).then(async (kind) => {
    if (kind === "file") return send(200, target);
    if (kind === "dir") {
      if (!url.pathname.endsWith("/")) {
        res.writeHead(301, { Location: `${url.pathname}/${url.search}` });
        res.end();
        return;
      }
      const index = join(target, "index.html");
      if ((await fileAt(index)) === "file") return send(200, index);
    }
    notFound();
  });
}).listen(port, () => {
  process.stdout.write(`Serving dist/ at http://localhost:${port}${BASE}\n`);
});
