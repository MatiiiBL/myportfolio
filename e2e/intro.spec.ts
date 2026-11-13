import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { INTRO_MIN_HEIGHT, INTRO_MIN_WIDTH } from "../src/pages/home/intro/screen";

// The home page's scroll intro (src/pages/home/intro): a pinned hero whose particle field moves
// through four formations as the page scrolls, then hands over to the hero's search. It plays
// only in large windows, and once per session: at its end, or when the visitor skips past it, it
// "arrives" and the hero stays as it left it.

/** Scrolls so the intro is at progress p (0 at its top, 1 where the hero unpins), plus `past` px. */
async function scrollIntroTo(page: Page, p: number, past = 0): Promise<void> {
  await page.evaluate(
    ([progress, extra]) => {
      const root = document.querySelector<HTMLElement>(".intro");
      const pin = root?.querySelector<HTMLElement>(".intro-pin");
      if (!root || !pin) throw new Error("no intro");
      const sticky = parseFloat(getComputedStyle(pin).top) || 0;
      const top = root.getBoundingClientRect().top + window.scrollY - sticky;
      const range = root.offsetHeight - pin.offsetHeight;
      window.scrollTo({ top: top + progress * range + extra, behavior: "instant" });
    },
    [p, past],
  );
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

/** Sums the layout shifts the page reports, from before its first paint. */
async function watchLayoutShifts(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const shifts = { total: 0 };
    Object.assign(window, { __shifts: shifts });
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      })[]) {
        if (!entry.hadRecentInput) shifts.total += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  return () =>
    page.evaluate(() => (window as unknown as { __shifts: { total: number } }).__shifts.total);
}

/** The intro has arrived: no animation, no pinned scroll space, the hero's search shown. */
async function expectArrived(page: Page): Promise<void> {
  await expect(page.locator(".intro")).toHaveAttribute("data-stage", "arrived");
  await expect(page.locator("html")).toHaveAttribute("data-intro", "arrived");
  await expect(page.locator(".intro-canvas")).toHaveCount(0);
  await expect(page.locator(".intro-label")).toHaveCount(0);
  const heights = await page.evaluate(() => ({
    intro: document.querySelector<HTMLElement>(".intro")?.offsetHeight,
    pin: document.querySelector<HTMLElement>(".intro-pin")?.offsetHeight,
  }));
  expect(heights.intro).toBe(heights.pin);
  const figure = page.locator(".hero-figure");
  await expect(figure).toHaveCSS("opacity", "1");
  await expect(figure).toHaveCSS("pointer-events", "auto");
}

test.describe("the scroll intro", () => {
  test.skip(({ isMobile }) => isMobile, "the intro plays only in large windows");
  test.use({ viewport: { width: 1280, height: 900 } });

  test("advances as the page scrolls and reverses until it reaches its end", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("./");
    const intro = page.locator(".intro");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "play");
    await expect(intro).toHaveAttribute("data-stage", "silicon");
    await expect(page.locator(".intro-canvas")).toHaveAttribute("aria-hidden", "true");
    const path: [number, string][] = [
      [0.34, "robots"],
      [0.63, "models"],
      [0.9, "search"],
      [0.63, "models"],
      [0.34, "robots"],
      [0.05, "silicon"],
      [0.9, "search"],
    ];
    for (const [p, stage] of path) {
      await scrollIntroTo(page, p);
      await expect(intro).toHaveAttribute("data-stage", stage);
    }
    await expect(page.locator(".hero-figure")).toHaveCSS("opacity", "0");
    await scrollIntroTo(page, 1);
    await expectArrived(page);
    expect(errors).toEqual([]);
  });

  test("stays arrived when the page scrolls back up", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("./");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    await scrollIntroTo(page, 1);
    await expectArrived(page);
    // The hero is where the intro left it (to the pixel), now at the top of the page.
    expect(await page.evaluate(() => window.scrollY)).toBeLessThanOrEqual(1);

    await page.evaluate(() => window.scrollTo({ top: 1500, behavior: "instant" }));
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.waitForTimeout(300);
    await expectArrived(page);
    // At the top of the page, right under the header.
    const header = await page.locator(".site-header").boundingBox();
    const hero = await page.locator(".intro-pin").boundingBox();
    expect(hero?.y).toBeCloseTo((header?.y ?? 0) + (header?.height ?? 0), 0);
    expect(errors).toEqual([]);
  });

  test("moves nothing on screen as it arrives", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    // Scroll past the end, so the stage has unpinned and Selected work is in view, and watch
    // where its heading is on every frame until well after the intro has collapsed.
    await scrollIntroTo(page, 1, 200);
    const frames = await page.evaluate(
      () =>
        new Promise<{ top: number; scroll: number }[]>((resolve) => {
          const heading = document.querySelector("#work h2");
          const seen: { top: number; scroll: number }[] = [];
          const sample = () => {
            seen.push({ top: heading?.getBoundingClientRect().top ?? NaN, scroll: scrollY });
            if (seen.length < 90) requestAnimationFrame(sample);
            else resolve(seen);
          };
          requestAnimationFrame(sample);
        }),
    );
    await expectArrived(page);
    const first = frames[0];
    const last = frames[frames.length - 1];
    if (!first || !last) throw new Error("no frames");
    // The page did collapse while it was watched (by the four screens of scroll)...
    expect(first.scroll - last.scroll).toBeGreaterThan(1000);
    // ...and the heading never moved.
    for (const { top } of frames) expect(Math.abs(top - first.top)).toBeLessThan(1);
  });

  test("labels the formation in view and links it to its project", async ({ page }) => {
    await page.goto("./");
    await scrollIntroTo(page, 0.34);
    const label = page.getByRole("link", { name: "Robotics · Apex" });
    await expect(label).toBeVisible();
    await expect(label).toHaveAttribute("href", "/myportfolio/projects/apex/");
    // The other labels are hidden, so the keyboard cannot reach them either.
    await expect(page.getByRole("link", { name: "RTL · Pulse" })).toBeHidden();
  });

  test("has no accessibility violations playing or arrived, in either theme", async ({ page }) => {
    // Every load plays the intro here.
    await page.addInitScript(() => sessionStorage.removeItem("intro"));
    for (const colorScheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("./");
      await scrollIntroTo(page, 0.63);
      await expect(page.locator(".intro")).toHaveAttribute("data-stage", "models");
      const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];
      const playing = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(playing.violations, `${colorScheme} theme, playing`).toEqual([]);
      await scrollIntroTo(page, 1);
      await expectArrived(page);
      const arrived = await new AxeBuilder({ page }).withTags(tags).analyze();
      expect(arrived.violations, `${colorScheme} theme, arrived`).toEqual([]);
    }
  });

  test("fits the smallest window it plays in and 1280 px without sideways scrolling", async ({
    page,
  }) => {
    // Every load plays the intro here, so each window goes through it.
    await page.addInitScript(() => sessionStorage.removeItem("intro"));
    for (const [width, height] of [
      [INTRO_MIN_WIDTH, INTRO_MIN_HEIGHT],
      [1280, 900],
    ] as const) {
      await page.setViewportSize({ width, height });
      await page.goto("./");
      await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
      for (const p of [0, 0.2, 0.5, 0.8, 1]) {
        await scrollIntroTo(page, p);
        if (p === 1) await expectArrived(page);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${width} px at ${p}`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("arrives when the window becomes too small for it, and does not come back", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await page.goto("./");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    await scrollIntroTo(page, 0.45);
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", /robots|models/);
    const pinned = await page.locator(".intro-pin").boundingBox();
    await page.setViewportSize({ width: 800, height: 900 });
    await expectArrived(page);
    // The stage stays where it was pinned, at the top, under the header.
    const stage = await page.locator(".intro-pin").boundingBox();
    expect(stage?.y).toBeCloseTo(pinned?.y ?? NaN, 0);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.waitForTimeout(300);
    await expectArrived(page);
    expect(errors).toEqual([]);
  });

  test("can be skipped from the keyboard", async ({ page }) => {
    await page.goto("./");
    const skip = page.getByRole("link", { name: "Skip intro" });
    await skip.focus();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#work$/);
    await expectArrived(page);
    await expect(page.locator("#work")).toBeInViewport();
    await expect(page.locator("#work")).toBeFocused();
  });

  test("arrives when a header link jumps to a section below", async ({ page }) => {
    await page.goto("./");
    await scrollIntroTo(page, 0.3);
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "robots");
    await page.locator(".site-nav").getByRole("link", { name: "About" }).click();
    await expect(page).toHaveURL(/#about$/);
    await expectArrived(page);
    await expect(page.locator("#about")).toBeInViewport();
  });

  test("arrives when End jumps past it, and steps through it with Page Down", async ({ page }) => {
    await page.goto("./");
    const intro = page.locator(".intro");
    await expect(intro).toHaveAttribute("data-stage", "silicon");
    // A page step inside the intro advances it.
    await page.keyboard.press("PageDown");
    await expect(intro).toHaveAttribute("data-stage", "robots");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "play");
    // A page step that would pass its end arrives.
    await scrollIntroTo(page, 0.9);
    await expect(intro).toHaveAttribute("data-stage", "search");
    await page.keyboard.press("PageDown");
    await expectArrived(page);

    // End, from the top of a new session's intro.
    await page.evaluate(() => sessionStorage.clear());
    await page.goto("./");
    await expect(intro).toHaveAttribute("data-stage", "silicon");
    await page.keyboard.press("End");
    await expectArrived(page);
    await expect
      .poll(() =>
        page.evaluate(() => {
          const { scrollHeight, clientHeight } = document.documentElement;
          return window.scrollY + clientHeight - scrollHeight;
        }),
      )
      .toBeGreaterThanOrEqual(-1);
  });

  test("takes a keyboard user who tabs into the hidden search straight to it", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    await page.getByRole("group", { name: /HNSW search demo/ }).focus();
    await expectArrived(page);
    await expect(page.locator(".hero-figure")).toBeInViewport();
  });

  test("starts arrived on a visit to a section of the home page", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("./#work");
    await expectArrived(page);
    await expect(page.locator("#work")).toBeInViewport();
    expect(errors).toEqual([]);
  });

  test("does not replay within a session, and plays again in a new one", async ({
    page,
    browser,
    baseURL,
  }) => {
    const errors = collectErrors(page);
    await page.goto("./");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    await scrollIntroTo(page, 1);
    await expectArrived(page);

    // To a project page and back.
    const card = page.locator("#work .work-link").first();
    await card.scrollIntoViewIfNeeded();
    await card.click();
    await expect(page).toHaveURL(/\/projects\//);
    await page.goBack();
    await expectArrived(page);
    await expect(card).toBeInViewport();

    // Through a project page's link back to the work.
    await card.click();
    await page.getByRole("link", { name: "← All work" }).click();
    await expect(page).toHaveURL(/\/#work$/);
    await expectArrived(page);
    await expect(page.locator("#work")).toBeInViewport();

    // A full load in the same session: arrived before the first paint.
    await page.goto("./");
    await expect(page.locator("html")).toHaveAttribute("data-intro", "arrived");
    await expectArrived(page);
    expect(errors).toEqual([]);

    // A new session plays it again.
    const context = await browser.newContext({ baseURL });
    const fresh = await context.newPage();
    await fresh.goto("./");
    await expect(fresh.locator("html")).toHaveAttribute("data-intro", "play");
    await expect(fresh.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    await context.close();
  });

  test("plays for a visitor who came in through a project page", async ({ page }) => {
    await page.goto("./projects/apex/");
    await page.getByRole("link", { name: "Matías Blanco" }).first().click();
    await expect(page.locator("html")).toHaveAttribute("data-intro", "play");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
  });
});

test.describe("in smaller windows", () => {
  const windows = [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    // A short laptop window.
    { width: 1280, height: INTRO_MIN_HEIGHT - 40 },
  ];

  test("the home page is the plain hero from the first paint", async ({ page, isMobile }) => {
    const errors = collectErrors(page);
    const shifts = await watchLayoutShifts(page);
    // On the phone, its own screen first; and an arrival earlier in the session changes nothing.
    await page.addInitScript(() => sessionStorage.setItem("intro", "arrived"));
    for (const size of isMobile ? [null, ...windows.slice(0, 2)] : windows) {
      if (size) await page.setViewportSize(size);
      await page.goto("./");
      const label = size ? `${size.width} × ${size.height}` : "Pixel 7";
      await expect(page.locator("html"), label).not.toHaveAttribute("data-intro");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect(page.locator(".intro-canvas"), label).toHaveCount(0);
      await expect(page.locator(".intro-skip"), label).toHaveCount(0);
      await expect(page.locator(".intro"), label).not.toHaveAttribute("data-stage");
      const layout = await page.evaluate(() => ({
        intro: document.querySelector<HTMLElement>(".intro")?.offsetHeight,
        hero: document.querySelector<HTMLElement>(".hero")?.offsetHeight,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      }));
      expect(layout.intro, label).toBe(layout.hero);
      expect(layout.overflow, label).toBeLessThanOrEqual(0);
      await expect(page.locator(".hero-figure"), label).toHaveCSS("opacity", "1");
      expect(await shifts(), label).toBe(0);
    }
    expect(errors).toEqual([]);
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the intro is absent and the hero is as it was", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("./");
    await expect(page.locator("html")).not.toHaveAttribute("data-intro");
    await expect(page.locator(".intro-canvas")).toHaveCount(0);
    await expect(page.locator(".intro")).not.toHaveAttribute("data-stage");
    const heights = await page.evaluate(() => ({
      intro: document.querySelector<HTMLElement>(".intro")?.offsetHeight,
      hero: document.querySelector<HTMLElement>(".hero")?.offsetHeight,
    }));
    expect(heights.intro).toBe(heights.hero);
    await expect(page.locator(".hero-figure")).toHaveCSS("opacity", "1");
    expect(errors).toEqual([]);
  });
});
