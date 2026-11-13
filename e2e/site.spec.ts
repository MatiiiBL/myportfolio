import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { profile } from "../src/content/profile";
import { projects } from "../src/content/projects";

// Every route of the site: it renders from the prerendered HTML, hydrates without errors, has
// no accessibility violations in either theme, fits a phone's width, and links only to pages
// that exist.

interface Route {
  path: string;
  status: number;
  heading: string;
}

const routes: Route[] = [
  { path: "./", status: 200, heading: profile.name },
  ...projects.map((p) => ({ path: `./projects/${p.slug}/`, status: 200, heading: p.name })),
  { path: "./no-such-page/", status: 404, heading: "Page not found" },
];

/** Console errors and uncaught exceptions, minus the 404 document's own failed load. */
function collectErrors(page: Page, status: number): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (status === 404 && message.text().includes("status of 404")) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

for (const route of routes) {
  test.describe(`route ${route.path}`, () => {
    test("renders, hydrates and logs no errors", async ({ page }) => {
      const errors = collectErrors(page, route.status);
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(route.status);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(route.heading);
      await page.waitForLoadState("networkidle");
      expect(errors).toEqual([]);
    });

    test("has no accessibility violations in either theme", async ({ page }) => {
      for (const colorScheme of ["dark", "light"] as const) {
        await page.emulateMedia({ colorScheme });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
          .analyze();
        expect(results.violations, `${colorScheme} theme`).toEqual([]);
      }
    });

    test("fits the viewport width, down to 320 px", async ({ page }) => {
      // The project's own viewport first, then the narrowest phone the quality bar names.
      const height = page.viewportSize()?.height ?? 800;
      for (const width of [null, 320]) {
        if (width) await page.setViewportSize({ width, height });
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");
        const overflow = await page.evaluate(() => {
          const limit = document.documentElement.clientWidth;
          const wide = [...document.querySelectorAll("body *")]
            .filter((el) => el.getBoundingClientRect().right > limit + 0.5)
            .filter((el) => !el.closest(".visually-hidden, .project-table-wrap, [hidden]"))
            .slice(0, 3)
            .map((el) => `${el.tagName.toLowerCase()}.${[...el.classList].join(".")}`);
          return { by: document.documentElement.scrollWidth - limit, wide };
        });
        expect(
          overflow.by,
          `${width ?? "default"} px: ${overflow.wide.join(", ")}`,
        ).toBeLessThanOrEqual(0);
      }
    });
  });
}

test("every internal link leads to a page and every fragment to an element", async ({
  page,
  request,
}) => {
  const targets = new Map<string, Set<string>>();
  for (const route of routes) {
    await page.goto(route.path);
    await page.waitForLoadState("networkidle");
    const hrefs = await page.$$eval("a[href]", (links) =>
      links.map((a) => (a as HTMLAnchorElement).href),
    );
    const here = new URL(page.url());
    for (const href of hrefs) {
      const url = new URL(href);
      if (url.origin !== here.origin) continue;
      // A fragment on the page itself (the skip link, the table of contents) is checked here.
      if (url.pathname === here.pathname && url.hash) {
        const id = decodeURIComponent(url.hash.slice(1));
        await expect(page.locator(`[id="${id}"]`), `${here.pathname}#${id}`).toHaveCount(1);
        continue;
      }
      const key = url.pathname;
      const fragments = targets.get(key) ?? new Set<string>();
      if (url.hash) fragments.add(decodeURIComponent(url.hash.slice(1)));
      targets.set(key, fragments);
    }
  }
  expect(targets.size).toBeGreaterThan(routes.length - 2);
  for (const [path, fragments] of targets) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    if (fragments.size === 0) continue;
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    for (const id of fragments) {
      await expect(page.locator(`[id="${id}"]`), `${path}#${id}`).toHaveCount(1);
    }
  }
});

test("the static HTML carries the content, the metadata and the lazy page bodies", async ({
  request,
}) => {
  const home = await (await request.get("./")).text();
  expect(home).toContain(`<h1 id="hero-name" class="hero-name">${profile.name}</h1>`);
  expect(home).toContain('"@type":"Person"');
  expect(home).toContain(`<link rel="canonical" href="${profile.siteUrl}">`);
  expect(home).toContain('<meta property="og:image" content="');
  for (const p of projects) {
    const html = await (await request.get(`./projects/${p.slug}/`)).text();
    expect(html).toContain(`<h1 class="project-name">${p.name}</h1>`);
    expect(html).toMatch(/<section[^>]+class="section"/);
    expect(html).toContain(`href="${profile.siteUrl}projects/${p.slug}/"`);
  }
  const notFound = await request.get("./no-such-page/");
  expect(notFound.status()).toBe(404);
  expect(await notFound.text()).toContain('<meta name="robots" content="noindex">');
  expect((await request.get("./sitemap.xml")).status()).toBe(200);
  expect((await request.get("./robots.txt")).status()).toBe(200);
  expect((await request.get("./og.png")).headers()["content-type"]).toBe("image/png");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the pages are readable", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(profile.name);
    for (const p of projects) {
      await expect(page.getByRole("link", { name: p.name, exact: true }).first()).toBeVisible();
    }
    await page.goto(`./projects/${projects[0]?.slug ?? ""}/`);
    await expect(page.locator(".section").first()).toBeVisible();
  });
});

test("the theme toggle cycles system, dark and light, and remembers the choice", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("./");
  const root = page.locator("html");
  const toggle = page.getByRole("button", { name: /^Theme:/ });
  await expect(root).not.toHaveAttribute("data-theme");
  await expect(toggle).toHaveAccessibleName("Theme: system. Switch to dark.");

  await toggle.click();
  await expect(root).toHaveAttribute("data-theme", "dark");
  await toggle.click();
  await expect(root).toHaveAttribute("data-theme", "light");
  const background = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(await background()).toBe("rgb(255, 255, 255)");

  // The saved theme is applied before the app loads, even though the system prefers dark.
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  expect(await background()).toBe("rgb(255, 255, 255)");
  await page.unroute("**/assets/*.js");

  await page.reload();
  await page.getByRole("button", { name: /^Theme:/ }).click();
  await expect(root).not.toHaveAttribute("data-theme");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
});

test("following links updates the title, the scroll position and the focus", async ({ page }) => {
  const first = projects[0];
  if (!first) throw new Error("no projects");
  await page.goto("./");
  await page.getByRole("link", { name: first.name, exact: true }).first().click();
  await expect(page).toHaveURL(new RegExp(`/projects/${first.slug}/$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(first.name);
  await expect(page).toHaveTitle(new RegExp(`^${first.name}: `));
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator("#main")).toBeFocused();

  await page.getByRole("link", { name: "← All work" }).click();
  await expect(page).toHaveURL(/\/myportfolio\/#work$/);
  await expect(page.locator("#work")).toBeInViewport();
  await expect(page).toHaveTitle(new RegExp(`^${profile.name}`));
});

test("the HNSW search follows the query and says how much work it saved", async ({ page }) => {
  await page.goto("./");
  const demo = page.getByRole("group", { name: /HNSW search demo/ });
  const readout = page.locator(".hnsw-readout");
  const before = await readout.textContent();
  const route = () => page.locator(".hnsw-hop").evaluateAll((lines) => lines.length);
  await expect.poll(route).toBeGreaterThan(0);

  await demo.focus();
  for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowUp");
  await expect(readout).not.toHaveText(before ?? "");
  await expect(readout).toContainText("of 96 distances computed");
  await expect(
    page.locator("[aria-live]").filter({ hasText: "distance computations" }),
  ).toHaveCount(1);

  const box = await demo.boundingBox();
  if (!box) throw new Error("the demo has no box");
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.9);
  await expect(page.locator(".hnsw-route.is-replaying")).toHaveCount(1);
});
