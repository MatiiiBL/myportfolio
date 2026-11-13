import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGE = "projects/precis/";

/**
 * Opens the page and waits until the network is idle: the prerendered markup is interactive only
 * once the page's lazy chunk has loaded and hydrated it.
 */
async function open(page: Page) {
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
}

const clock = (page: Page) => page.locator(".sim-clock");
const seconds = (text: string) => {
  const [m = "0", s = "0"] = text.split(":");
  return Number(m) * 60 + Number(s);
};
/** Simulated seconds shown, and the run's length, from "m:ss / m:ss". */
async function times(page: Page): Promise<[number, number]> {
  const text = (await clock(page).textContent()) ?? "";
  const [now = "", end = ""] = text.split("·")[0]?.split("/") ?? [];
  return [seconds(now.trim()), seconds(end.trim())];
}

for (const colorScheme of ["dark", "light"] as const) {
  test(`renders in the ${colorScheme} theme with no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Précis" })).toBeVisible();
    for (const title of ["Overview", "The pipeline under load", "Results", "How it works"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(page.getByRole("img", { name: /2,000 papers, one cell each/ })).toBeVisible();
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(violations).toEqual([]);
  });
}

test("the run plays once in view and the slider moves through it", async ({ page }) => {
  await open(page);
  await page.locator(".sim").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await times(page))[0]).toBeGreaterThan(10);
  await page.getByRole("button", { name: "Pause" }).click();

  const slider = page.getByRole("slider", { name: "Simulated time" });
  await slider.focus();
  await page.keyboard.press("End");
  const [now, end] = await times(page);
  expect(now).toBe(end);
  await expect(page.locator(".stages")).toContainText("Done, to topics2,000");
  await page.keyboard.press("Home");
  expect((await times(page))[0]).toBe(0);
  // At 0:00 the first 256 papers (two per slot of the ceiling of 128) have just been admitted.
  await expect(page.locator(".stages")).toContainText("Reader256");
  await expect(page.locator(".stages")).toContainText("Done, to topics0");
});

test("SIGKILL stops the run, it resumes, and nothing is paid twice", async ({ page }) => {
  await open(page);
  await page.locator(".sim").scrollIntoViewIfNeeded();
  await expect.poll(async () => (await times(page))[0]).toBeGreaterThan(30);
  await page.getByRole("button", { name: /SIGKILL/ }).click();
  const report = page.getByRole("status");
  await expect(report).toContainText("Killed at");
  await expect(page.getByRole("button", { name: /SIGKILL/ })).toBeDisabled();

  const slider = page.getByRole("slider", { name: "Simulated time" });
  await page.getByRole("button", { name: "Pause" }).click();
  await slider.focus();
  await page.keyboard.press("End");
  await expect(report).toContainText("replayed from the cache");
  await expect(report).toContainText("requests paid for twice: 0");
});

test("the server and the ceiling change the run", async ({ page }) => {
  await open(page);
  const [, at128] = await times(page);
  const ceiling = page.getByRole("group", { name: "concurrency ceiling", exact: true });
  await ceiling.getByRole("radio", { name: "32", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect.poll(async () => (await times(page))[1]).toBeGreaterThan(at128 * 2);

  await page.getByRole("radio", { name: "Overloaded server" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("radio", { name: "Injected faults" })).toBeChecked();
  await expect(ceiling).toHaveCount(0);
  await expect(page.locator("figure").first()).toContainText("500 papers");
});

test("reduced motion shows the finished run, without playback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);
  const [now, end] = await times(page);
  expect(now).toBe(end);
  expect(end).toBeGreaterThan(0);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the prerendered page shows the finished run and its charts", async ({ page }) => {
    await page.goto(PAGE);
    const [now, end] = await times(page);
    expect(end).toBeGreaterThan(0);
    expect(now).toBe(end);
    await expect(page.locator(".stages")).toContainText("Done, to topics2,000");
    // Both charts are drawn to the end: one line each for the window and the slots held, and
    // two for the papers per minute.
    await expect(page.locator(".live-chart .chart-line")).toHaveCount(4);
  });
});

for (const width of [320, 390]) {
  test(`nothing scrolls sideways on a ${width} px screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await open(page);
    await expect(page.locator(".paper-grid canvas")).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
}
