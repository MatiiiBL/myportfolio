# The site: design contract

Matías Blanco's personal site, served at https://matiiibl.github.io/myportfolio/ from the
`gh-pages` branch, which `.github/workflows/deploy.yml` builds from `Main`. It replaces an older
template portfolio entirely. This document is the contract between the people building it: the
structure, the content rules, the visual language and the quality bar.

## 1. Audience and goal

Recruiters, engineers and professors who arrive from a resume, a cold email or the GitHub
profile. In ten seconds they should know who Matías is (Computer Engineering at Columbia, builds
fast and verified systems from scratch) and see the strongest work; in two minutes on a project
page an engineer should understand what was built, how, how well it works (numbers) and where its
limits are. The tone is the GitHub profile's: concrete, measured, no buzzwords, no hype, no
emoji.

## 2. Structure

| Route              | Content                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `/`                | Hero, selected work (the six flagship projects, then memo, WattsGood, ShellC), experience, toolbox, about, contact |
| `/projects/<slug>` | One deep-dive page per flagship project: pulse, apex, vecdex, minillm, tessera, precis                             |
| anything else      | 404 page                                                                                                           |

Every route is prerendered to static HTML at build time, so deep links load with status 200 and
search engines and link previews see the content without running JavaScript.

### Code layout

```
src/
  content/        typed content: types.ts, profile.ts, projects.ts  (the single source of truth)
  styles/         tokens.css (design tokens), global.css (base)
  components/     shared components: Shell, ProjectLayout, Section, Stat, Chip, charts/, ...
  pages/          Home, NotFound
  projects/
    registry.ts   slug -> lazy page module
    <slug>/       Page.tsx (default export: the page body) + that project's visualizations,
                  data (data/*.json with a SOURCE note) and tests
e2e/              Playwright tests against the production build
docs/site.md      this document
```

## 3. Content rules

- **Every number is sourced.** Headline stats live in `src/content/projects.ts`; numbers on a
  project page come from that project's repository: its README, docs or committed results.
  Data files copied from a repository sit in `src/projects/<slug>/data/` with a `SOURCE.md` that
  names the repository, the file path and the commit. Never invent, round up or extrapolate a
  number; when a result is from simulation (Précis's throughput, Apex's runs), say so.
- **Honest limits.** Each project page has a short "Limits" or "What's next" section taken from
  the repository's own limitations section.
- Prose: short sentences, active voice, the first person for Matías's own work ("I built...") and
  plain technical words. Explain each acronym on first use. No marketing adjectives ("blazing",
  "cutting-edge", "seamless"), no exclamation marks, no emoji.
- Personal data on the site is limited to what `src/content/profile.ts` holds. No phone number,
  no address, no resume file unless Matías adds one.

## 4. Visual language

The site and the GitHub profile (github.com/MatiiiBL) are one identity:

- Colors only through the tokens in `src/styles/tokens.css`: GitHub-dark neutrals, a single gold
  accent (`--accent`) for emphasis, and the three series colors (`--series-1..3`) for charts. Dark
  is the default; light follows the system or the visitor's choice, and every page must look
  right in both.
- Type: Inter (variable) for text, JetBrains Mono for kickers, tags, code, axis labels and data.
  Kickers are uppercase mono in the accent color, as on the profile cards.
- Layout: a 1120 px content column, generous whitespace, cards with 1 px borders and 10–14 px
  radii, no drop-shadow stacks, no glassmorphism, no gradients except a faint one on hero
  surfaces.
- Motion is purposeful: it explains something (an algorithm stepping, data flowing). Nothing
  animates on its own except where it demonstrates the system, and everything honors
  `prefers-reduced-motion` (a static, complete frame instead of the animation).
- Each project page has one **signature visualization**: an interactive explanation of the
  project's core idea, built from the project's own data or a faithful small-scale model of its
  algorithm, not a stock image or a screenshot.

## 5. Project pages

`ProjectRoute` renders `ProjectLayout` (header: kicker, name, tagline, links, the three stats,
tags) around the page body exported by `src/projects/<slug>/Page.tsx`. A body is a sequence of
`<Section id title kicker?>` blocks, typically:

1. **Overview**: what it is and why it is interesting, in two short paragraphs.
2. **The signature visualization**, with a caption that says what the viewer is looking at.
3. **Results**: the key measurements as charts and small tables, each with its source.
4. **How it works**: the architecture and the two or three design decisions that matter most.
5. **Limits**: what it does not do yet.

Pages are code-split (lazy-loaded) so the home page stays light; a page's heavy data loads with
it, never with the home page.

## 6. Charts and visualizations

- Build charts from the shared primitives in `src/components/charts/` (axes, scales via
  d3-scale and d3-shape, legend, tooltip, a table fallback) so every chart looks and behaves the
  same. Load the `dataviz` skill before writing chart code and follow it: one y-axis, legends for
  two or more series plus direct labels where useful, thin marks, text in text tokens, hover or
  focus tooltips, and a data table available to screen readers.
- SVG for charts and diagrams; canvas only where thousands of marks need it.
- Keyboard and screen-reader accessible: interactive controls are real buttons, sliders and
  inputs with labels; each visualization has a text alternative describing what it shows.
- Deterministic: any randomness uses a seeded generator, so the page renders the same every time.

## 7. Quality bar

- TypeScript strict, ESLint clean, Prettier formatted. `npm run check` (format, lint, typecheck,
  unit tests, build) must pass on every commit; `npm run e2e` (Playwright, desktop and mobile,
  with axe accessibility checks) before a merge.
- Accessibility: WCAG 2.2 AA. Semantic landmarks and headings, visible focus, sufficient contrast
  in both themes, alt text, no information carried by color alone, works at 320 px wide and at
  200% zoom.
- Performance: Lighthouse 95+ in every category on the home page and every project page (mobile
  profile). Home page JavaScript under 120 kB gzipped; fonts self-hosted (no third-party
  requests at all); images sized and lazy-loaded.
- Works without JavaScript for reading (prerendered HTML); interactivity is an enhancement.
- No analytics, trackers or cookies.

## 8. Build and deploy

`npm run build` = typecheck + Vite build + prerender. The deploy workflow runs the checks and the
end-to-end tests, then publishes `dist/` to `gh-pages` on every push to `Main`. Work happens on
branches; `Main` is pushed only when the site is ready.
