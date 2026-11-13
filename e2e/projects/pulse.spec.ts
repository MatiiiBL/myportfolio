import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const PAGE = "projects/pulse/";

/**
 * Opens the page and waits until the network is idle: the prerendered markup is interactive only
 * once the page's lazy chunk has loaded and hydrated it.
 */
async function open(page: Page) {
  await page.goto(PAGE);
  await page.waitForLoadState("networkidle");
}

for (const colorScheme of ["dark", "light"] as const) {
  test(`renders in the ${colorScheme} theme with no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await open(page);
    await expect(page.getByRole("heading", { level: 1, name: "Pulse" })).toBeVisible();
    for (const title of ["Overview", "The array, cycle by cycle", "Results", "How it works"]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    await expect(page.locator(".array-grid .pe")).toHaveCount(64);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}

test("the stepper follows the mouse and the keyboard", async ({ page }) => {
  await open(page);
  const slider = page.getByRole("slider");
  const cycles = page.locator(".stepper__cycles");
  const start = Number(await slider.inputValue());

  await page.getByRole("button", { name: "Forward one cycle" }).click();
  await expect(slider).toHaveValue(String(start + 1));
  await expect(cycles).toHaveText(`CYCLES ${start + 1}`);

  await page.locator(".array-grid .pe").first().click();
  await expect(page.locator(".stepper__inspector")).toContainText("PE (0, 0)");

  await slider.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveValue(String(start));
  await page.keyboard.press("Home");
  await expect(page.locator(".stepper__phase")).toHaveText(/^Load/);
  await page.keyboard.press("End");
  await expect(page.locator(".stepper__phase")).toHaveText("Done");
  // The finished tile: every sum final and equal to the plain product, every element written.
  await expect(page.locator(".stepper__check")).toContainText(
    "64 of 64 sums are final and 64 of them equal",
  );
  await expect(page.getByRole("table", { name: /written/ })).toHaveAccessibleName(/64 of 64/);

  await page.getByRole("button", { name: "Replay" }).click();
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(2);
  await page.getByRole("button", { name: "Pause" }).click();
});

test("a smaller tile leaves the other PEs out", async ({ page }) => {
  await open(page);
  await page
    .getByRole("combobox", { name: "Tile" })
    .selectOption({ label: "5 × 3 × 6, a partial tile" });
  await expect(page.locator(".array-grid .pe--outside")).toHaveCount(64 - 15);
});

test("reduced motion opens on the finished command", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  await expect(page.locator(".stepper__phase")).toHaveText("Done");
});

test("nothing scrolls sideways on a 390 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  await expect(page.locator(".array-grid")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
