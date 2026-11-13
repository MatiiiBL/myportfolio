import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGE = "projects/tessera/";

/**
 * Opens the page and waits until the network is idle: the prerendered markup is interactive only
 * once the page's lazy chunk has loaded and hydrated it.
 */
async function open(page: Page) {
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
}

const knob = (page: Page, name: RegExp) => page.getByRole("group", { name });
const ir = (page: Page) => page.getByLabel("Scheduled loop IR");

for (const colorScheme of ["dark", "light"] as const) {
  test(`renders in the ${colorScheme} theme with no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Tessera" })).toBeVisible();
    for (const title of [
      "Overview",
      "Scheduling one kernel",
      "Results",
      "How it works",
      "Limits",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(ir(page)).toContainText("for n_0 in parallel(8):");
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"])
      .analyze();
    expect(violations).toEqual([]);
  });
}

test("the knobs rewrite the loop IR, by mouse and by keyboard", async ({ page }) => {
  await open(page);
  await knob(page, /tile_m/)
    .getByText("8", { exact: true })
    .click();
  await expect(ir(page)).toContainText("for m_1 in unrolled(8):");
  await expect(page.getByText("8 × 16 = 128 accumulators")).toBeVisible();

  // Arrow keys move through a radio group: nm to mn fuses the tile loops.
  await knob(page, /order/).getByRole("radio", { name: /^nm/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(ir(page)).toContainText("m_0_n_0_fused");
  await expect(ir(page)).not.toContainText("W_local");

  await page.getByRole("button", { name: "Reset to the defaults" }).click();
  await expect(ir(page)).toContainText("W_local[v0_1, v1_1] = W[v0_1, v1_1]");
});

test("a trace step marks the lines it produced", async ({ page }) => {
  await open(page);
  const marked = page.locator(".ir-line.is-marked");
  await expect(marked).toHaveCount(0);
  await page.getByRole("button", { name: "cache_read('matmul', 1, 'local') -> 'W_local'" }).click();
  // The main block now reads the packed copy.
  await expect(marked.filter({ hasText: "* W_local[v_k, v_n]" })).toHaveCount(1);
  await page.getByRole("button", { name: "unroll(m_1)" }).focus();
  await page.keyboard.press("Enter");
  await expect(marked).toHaveCount(1);
  await expect(marked).toHaveText("for m_1 in unrolled(4):");
});

test("the access view steps through the tiles", async ({ page }) => {
  await open(page);
  const slider = page.getByRole("slider", { name: "Tile" });
  const label = page.locator(".step-label");
  await expect(label).toContainText("Tile 1 of 128");
  await page.getByRole("button", { name: "Next tile" }).click();
  await expect(label).toContainText("n_0 = 0, m_0 = 1: rows 4–7, columns 0–15");
  await slider.focus();
  await page.keyboard.press("End");
  await expect(label).toContainText("Tile 128 of 128");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveValue("126");
  await page.getByRole("button", { name: "Play" }).click();
  await expect(label).toContainText("Tile 128 of 128");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  await page.getByRole("button", { name: "Play" }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(3);
  await page.getByRole("button", { name: "Pause" }).click();
});

test("selecting an operator finds it in the other column", async ({ page }) => {
  await open(page);
  const fused = page.getByRole("region", { name: "Fused" });
  const unfused = page.getByRole("region", { name: "Fusion off" });
  await fused.getByRole("button", { name: /^Add:/ }).click();
  await expect(unfused.locator(".fusion-kernel.is-active")).toHaveCount(1);
  await expect(unfused.locator(".fusion-kernel.is-active")).toContainText("writes Add");
  await expect(fused.locator(".fusion-kernel.is-active")).toContainText("conv3");
});

test("reduced motion offers no playback", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(page.getByRole("button", { name: "Next tile" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Play" })).toHaveCount(0);
});

test("nothing scrolls sideways on a 390 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(ir(page)).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
