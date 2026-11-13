import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// The home page's scroll intro (src/pages/home/intro): a pinned hero whose particle field moves
// through four formations as the page scrolls, then hands over to the hero's search.

/** Scrolls so the intro is at progress p (0 at its top, 1 where the hero unpins). */
async function scrollIntroTo(page: Page, p: number): Promise<void> {
  await page.evaluate((progress) => {
    const root = document.querySelector<HTMLElement>(".intro");
    const pin = root?.querySelector<HTMLElement>(".intro-pin");
    if (!root || !pin) throw new Error("no intro");
    const sticky = parseFloat(getComputedStyle(pin).top) || 0;
    const top = root.getBoundingClientRect().top + window.scrollY - sticky;
    const range = root.offsetHeight - pin.offsetHeight;
    window.scrollTo({ top: top + progress * range, behavior: "instant" });
  }, p);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(String(error)));
  return errors;
}

test.describe("the scroll intro", () => {
  test("advances as the page scrolls and reverses when it scrolls back", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("./");
    const intro = page.locator(".intro");
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
    // At the end the hero's search is shown and takes input again.
    const figure = page.locator(".hero-figure");
    await expect(figure).toHaveCSS("opacity", "0");
    await scrollIntroTo(page, 1);
    await expect(figure).toHaveCSS("opacity", "1");
    await expect(figure).toHaveCSS("pointer-events", "auto");
    expect(errors).toEqual([]);
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

  test("has no accessibility violations mid-way, in either theme", async ({ page }) => {
    for (const colorScheme of ["dark", "light"] as const) {
      await page.emulateMedia({ colorScheme });
      await page.goto("./");
      await scrollIntroTo(page, 0.63);
      await expect(page.locator(".intro")).toHaveAttribute("data-stage", "models");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
        .analyze();
      expect(results.violations, `${colorScheme} theme`).toEqual([]);
    }
  });

  test("fits 320, 390 and 1280 px without sideways scrolling", async ({ page }) => {
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("./");
      for (const p of [0, 0.2, 0.5, 0.8, 1]) {
        await scrollIntroTo(page, p);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${width} px at ${p}`).toBeLessThanOrEqual(0);
      }
    }
  });

  test("can be skipped from the keyboard", async ({ page }) => {
    await page.goto("./");
    const skip = page.getByRole("link", { name: "Skip intro" });
    await skip.focus();
    await expect(skip).toBeInViewport();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#work$/);
    await expect(page.locator("#work")).toBeInViewport();
  });

  test("takes a keyboard user who tabs into the hidden search straight to it", async ({ page }) => {
    await page.goto("./");
    await expect(page.locator(".intro")).toHaveAttribute("data-stage", "silicon");
    await page.getByRole("group", { name: /HNSW search demo/ }).focus();
    await expect(page.locator(".hero-figure")).toHaveCSS("opacity", "1");
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
