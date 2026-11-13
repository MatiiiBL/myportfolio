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

## Deploy

Pushing to `Main` runs `.github/workflows/deploy.yml`: the checks, the build with the prerender
and the end-to-end tests, then it publishes `dist/` to the `gh-pages` branch, which GitHub Pages
serves. Other branches and pull requests run the same checks in `.github/workflows/ci.yml`.

`robots.txt` and `sitemap.xml` are published under `/myportfolio/`. Crawlers only read
`robots.txt` at the root of a host, so the sitemap is there to be submitted to search consoles
directly.
