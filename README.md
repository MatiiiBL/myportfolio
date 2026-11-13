# matiiibl.github.io/myportfolio

My personal site: who I am, the systems I have built, and how well they work. It is live at
[matiiibl.github.io/myportfolio](https://matiiibl.github.io/myportfolio/).

The home page leads with a live HNSW search (the index behind vecdex) running in the browser,
then the six flagship projects, the smaller ones, experience, toolbox and contact. Each flagship
project has a deep-dive page with an interactive explanation of its core idea and charts of its
measured results, every number taken from the project's own repository.

It is a React 19 and TypeScript app built with Vite. Every page is prerendered to static HTML at
build time, so it loads fast, reads without JavaScript and links straight to any page; the
browser then hydrates it for the interactive parts. There are no analytics, cookies or
third-party requests, and the fonts are self-hosted.

## Run it

You need Node 24 and npm.

```sh
npm ci
npm run dev        # http://localhost:5173/myportfolio/
```

## Build and test

| Command                | What it does                                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run check`        | Prettier, ESLint, TypeScript, the Vitest unit tests and the production build. Every commit passes it.                                            |
| `npm run build`        | Type-checks, builds the client, builds `src/entry-server.tsx` for Node and runs `scripts/prerender.ts`, which writes every page into `dist/`.    |
| `npm run preview`      | Serves `dist/` the way GitHub Pages does (404 page with status 404, trailing-slash redirects, gzip) at http://localhost:4173/myportfolio/.       |
| `npm run e2e`          | Playwright tests against the build, in desktop and mobile Chrome. Run `npx playwright install chromium` once first.                              |
| `npm run share-assets` | Redraws `public/og.png` (the 1200×630 share image) and the PNG icons with headless Chromium. Run it after changing the profile text or the icon. |

The end-to-end tests visit every route and check that it renders and hydrates without console
errors, has no axe accessibility violations in either theme, fits a phone's width, and links only
to pages and anchors that exist. They also check the prerendered HTML, reading without
JavaScript, the theme toggle, navigation and the home page's search demo. Set `E2E_PORT` to run
them on another port when 4173 is taken.

To measure performance the way the quality bar does (Lighthouse, mobile profile):

```sh
npm run build
npm run preview &
npx lighthouse http://localhost:4173/myportfolio/ --chrome-flags="--headless=new" \
  --only-categories=performance,accessibility,best-practices,seo
```

## Structure

```
src/
  content/          typed content: profile, projects and their types (the single source of truth)
  styles/           design tokens (tokens.css) and base styles (global.css)
  components/       the shell, ProjectLayout, Section, Stat, Chip, Figure, the table of contents
    charts/         chart primitives: LineChart, BarChart, ChartFrame, axes, marks, scales
  pages/            Home, NotFound, per-route metadata (meta.ts)
    home/           the HNSW search demo and the project cards
      intro/        the scroll intro over the hero (see below)
  projects/         one folder per flagship project: its page, visualizations, data and tests
  entry-server.tsx  renders a route to HTML for the prerender
scripts/
  prerender.ts      writes every route's static HTML, head tags and sitemap.xml into dist/
  serve.ts          serves dist/ like GitHub Pages, for preview, e2e and Lighthouse
  share-assets.ts   draws the share image and the icons in public/
public/             favicon, icons, share image, robots.txt
e2e/                Playwright tests against the production build
docs/site.md        the design contract: structure, content rules, visual language, quality bar
```

## The scroll intro

The top of the home page is a scroll-driven intro. The hero stays pinned for four screens of
scroll while a field of 1,200 particles (Canvas 2D) on its right becomes four of the projects in turn, then settles exactly onto the hero's HNSW graph and hands
over to it:

1. Silicon (Pulse): the 8 × 8 systolic array, with the compute wavefront sweeping it diagonally.
2. Robots (Apex): the cones of a simulated track, with the car lapping it.
3. Models (minillm): the causal attention triangle of one head.
4. Search (vecdex): the nodes and links of the hero's own graph, read from its SVG.

The motion is a pure function of the scroll position, so until its end, scrolling back up
replays it in reverse. It plays once: when the visitor reaches the end (the graph has formed and
the hero's interactive search has taken over, where the stage unpins), it "arrives". The pinned
scroll space collapses and the page scrolls by the same height in the same frame, so nothing on
screen moves, and from then on the top of the page is the hero as the intro left it: no way back
into the animation. It also arrives when the visitor skips past it: the "Skip intro" link, a link
to a section below (the header's, or a project page's "All work"), a visit that starts at a
section of the home page (`/#work`), End, a Page Down that would pass the end, or focus moving
into the hero's search or below the intro. The arrival is remembered for the browser session
(`sessionStorage`), so coming back to the home page, by a link, back and forward or a reload, shows
the arrived hero; a new session plays it again.

It runs only in a window at least 1024 px wide and 600 px tall (`src/pages/home/intro/screen.ts`),
when JavaScript runs and the visitor has not asked for reduced motion. In a smaller window the
formations would be too small to read (a phone) or the stage too squeezed (a short laptop window,
a phone on its side), so there, as with reduced motion, without JavaScript and in the prerendered
HTML, the home page is the plain hero from the first paint. A window that becomes smaller while
the intro plays (a resize, a rotation, split screen) arrives at once, the same way; growing it
again does not bring the intro back.

It is isolated so it can go as easily as it came:

- all of its code, styles, data and unit tests are in `src/pages/home/intro/` (the canvas engine
  is loaded on demand, in its own chunk);
- `src/pages/Home.tsx` mounts it once, as `<Intro>` around `<Hero />`;
- the head script in `index.html` sets `data-intro` on `<html>` to `play` or `arrived` before the
  first paint, so the page has its final height from the start and nothing shifts;
- a small plugin in `vite.config.ts` writes the window condition from `screen.ts` into that head
  script, so the script and the intro's code cannot disagree on it;
- `e2e/intro.spec.ts` tests it, and one test in `e2e/site.spec.ts` waits for it.

**How to remove the intro:** revert the commits that added and changed it, newest first. Every
one of them touches `src/pages/home/intro/`, so this reverts them all, along with the head
script, the mount point, the tests and this section:

```sh
git revert --no-edit $(git log --format=%h -- src/pages/home/intro)
```

Today those are three commits: "Open the home page with a scroll intro through four projects"
(`9f6e85b`), "Play the home page's scroll intro once per session" (`8805daf`), which made it
one-way, and "Play the scroll intro only in large windows".

## Deploy

Pushing to `Main` runs `.github/workflows/deploy.yml`: the checks, the build with the prerender
and the end-to-end tests, then it publishes `dist/` to the `gh-pages` branch, which GitHub Pages
serves. Other branches and pull requests run the same checks in `.github/workflows/ci.yml`.

`robots.txt` and `sitemap.xml` are published under `/myportfolio/`. Crawlers only read
`robots.txt` at the root of a host, so the sitemap is there to be submitted to search consoles
directly.
