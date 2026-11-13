import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL = "./projects/vecdex/";

/** Opens the page and waits for the network to settle: the explorer hydrates from a lazy chunk. */
async function open(page: Page) {
  await page.goto(URL);
  await page.waitForLoadState("networkidle");
}
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`vecdex page, ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("renders every section and has no axe violations", async ({ page }) => {
      await open(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("vecdex");
      for (const title of ["Overview", "Watch a search", "Results", "How it works", "Limits"]) {
        await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
      }
      await expect(page.locator(".hx-plot svg circle").first()).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test("the explorer answers the pointer and the keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const plot = page.getByRole("application", { name: /Query at/ });
  await expect(plot).toHaveAccessibleName("Query at x 400, y 450");

  // A click places the query where it lands (the plot spans 1,048 units with its margin).
  const svg = plot.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("the plot has no box");
  await svg.click({ position: { x: box.width * (524 / 1048), y: box.height * (224 / 1048) } });
  await expect(plot).not.toHaveAccessibleName("Query at x 400, y 450");
  const placed = (await plot.getAttribute("aria-label")) ?? "";
  const [, px, py] = /x (\d+), y (\d+)/.exec(placed) ?? [];
  expect(Math.abs(Number(px) - 500)).toBeLessThanOrEqual(6);
  expect(Math.abs(Number(py) - 200)).toBeLessThanOrEqual(6);
  await expect(page.locator(".hx-status")).toContainText("The search is done");

  // Arrow keys move it by 10 units, Shift by 50.
  await plot.focus();
  const before = (await plot.getAttribute("aria-label")) ?? "";
  const x = Number(/x (\d+)/.exec(before)?.[1]);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await expect(plot).toHaveAccessibleName(new RegExp(`Query at x ${x - 60},`));

  // Stepping walks the search from the top layer down.
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator(".hx-status")).toContainText(/Step \d+ of \d+/);
  const steps = Number(/of (\d+)/.exec(await page.locator(".hx-status").innerText())?.[1]);
  // Back to step 1 of `steps`: the first greedy step, on the top layer.
  for (let i = 2; i < steps; i++) await page.getByRole("button", { name: "Back" }).click();
  await expect(page.locator(".hx-status")).toContainText("Layer 4");
  await expect(page.locator('.hx-layers li[aria-current="step"]')).toContainText("Layer 4");
  await page.getByRole("button", { name: "Result" }).click();
  await expect(page.locator(".hx-stats")).toContainText("/10");

  // The ef slider changes the work done.
  const work = page.locator(".hx-stats dd").first();
  const atSixteen = await work.innerText();
  await page.getByRole("slider").fill("100");
  await expect(work).not.toHaveText(atSixteen);
});

test("plays the search step by step when motion is allowed", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "Replay" }).click();
  await expect(page.getByRole("button", { name: "Pause" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".hx-status")).toContainText("The search is done");
});

test("has no horizontal scroll on a 390 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator(".hx-plot")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
