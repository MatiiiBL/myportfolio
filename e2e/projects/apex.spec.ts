import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const PAGE = "projects/apex";

for (const colorScheme of ["dark", "light"] as const) {
  test(`renders in the ${colorScheme} theme with no accessibility violations`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(PAGE);
    await expect(page.getByRole("heading", { level: 1, name: "Apex" })).toBeVisible();
    for (const title of [
      "Overview",
      "Lap 1 maps the track, then the car races it",
      "Results",
      "How it works",
    ]) {
      await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
    }
    // The viewer opens on the last frame: the whole map.
    await expect(page.locator(".replay__readout")).toContainText("186 / 186");
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations).toEqual([]);
  });
}

test("the replay follows the keyboard", async ({ page }) => {
  await page.goto(PAGE);
  const slider = page.getByRole("slider");
  const status = page.locator(".replay__status");
  await slider.focus();
  await page.keyboard.press("Home");
  await expect(slider).toHaveValue("0");
  await expect(status).toHaveText("Staged, before the timing line");
  await expect(page.locator(".replay__readout")).toContainText("0 / 186");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("PageUp");
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveValue("21");
  await expect(status).toHaveText("Exploring, lap 1 of 10");
  // Partway through lap 1, part of the map is built and the car follows a planned path.
  const mapped = Number(
    (await page.locator(".replay__readout dd").nth(2).textContent())?.split("/")[0],
  );
  expect(mapped).toBeGreaterThan(0);
  expect(mapped).toBeLessThan(186);
  await expect(page.locator(".map-planned")).toHaveCount(1);
});

test("the replay follows the mouse", async ({ page }) => {
  await page.goto(PAGE);
  const slider = page.getByRole("slider");
  await page.getByRole("button", { name: /^Lap 3/ }).click();
  await expect(page.getByRole("button", { name: /^Lap 3/ })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator(".replay__status")).toHaveText("Racing, lap 3 of 10");
  const t0 = Number(await slider.inputValue());
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(t0 + 1);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.locator(".map-speed").first()).toBeVisible();
});

test("reduced motion shows a chosen lap complete instead of playing it", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(PAGE);
  await page.getByRole("button", { name: /^Lap 5/ }).click();
  await expect(page.locator(".replay__status")).toHaveText("Racing, lap 5 of 10");
  await expect(page.getByRole("button", { name: "Play" })).toBeVisible();
});

test("nothing scrolls sideways on a 390 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE);
  await expect(page.locator(".track-map")).toBeVisible();
  // A string expression: the e2e TypeScript project has no DOM types.
  const overflow = await page.evaluate(
    "document.documentElement.scrollWidth - document.documentElement.clientWidth",
  );
  expect(overflow).toBe(0);
});
