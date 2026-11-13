import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const URL = "./projects/minillm/";

/** Opens the page and waits for the network to settle: the figures hydrate from a lazy chunk. */
async function open(page: Page) {
  await page.goto(URL);
  await page.waitForLoadState("networkidle");
}
const AXE_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

for (const colorScheme of ["dark", "light"] as const) {
  test.describe(`minillm page, ${colorScheme} theme`, () => {
    test.use({ colorScheme });

    test("renders every section and has no axe violations", async ({ page }) => {
      await open(page);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("minillm");
      for (const title of [
        "Overview",
        "One decoding step",
        "Q8_0, one block at a time",
        "Results",
        "How it works",
        "Limits",
      ]) {
        await expect(page.getByRole("heading", { level: 2, name: title })).toBeVisible();
      }
      const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test("the decoding step answers the pointer and the keyboard", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page);
  const decode = page.locator("#decode");
  const rows = decode.locator(".ds-attn tbody tr");
  await expect(rows).toHaveCount(13);
  await expect(decode.locator(".ds-stats")).toContainText("585 KiB");

  // Picking position 3 rolls the cache back to four positions.
  await decode.getByRole("button", { name: "3 France", exact: true }).click();
  await expect(rows).toHaveCount(4);
  await expect(decode.locator(".ds-stats")).toContainText("180 KiB");

  // Arrow keys move the step; End jumps to the last token.
  await page.keyboard.press("ArrowRight");
  await expect(rows).toHaveCount(5);
  await expect(decode.getByRole("button", { name: "4 is", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(rows).toHaveCount(13);

  // The layer and head controls change what the table shows.
  const first = decode.locator(".ds-detail .ds-value").first();
  const layer15 = await first.innerText();
  await decode.getByRole("button", { name: "Layer 0" }).click();
  await expect(decode.getByRole("button", { name: "Layer 0" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(first).not.toHaveText(layer15);
  await decode.getByRole("button", { name: "Query head 2" }).click();
  await expect(decode.locator(".ds-detail-head")).toHaveText("Head 2");
});

test("the Q8_0 explorer answers the pointer and the keyboard", async ({ page }) => {
  await open(page);
  const q8 = page.locator("#q8");
  const cells = q8.locator(".q8-cell");
  await expect(cells).toHaveCount(32);

  // Another block, other int8 values.
  const before = await cells.allInnerTexts();
  await q8.getByRole("combobox", { name: "Block" }).selectOption({ index: 0 });
  await expect.poll(() => cells.allInnerTexts()).not.toEqual(before);

  // Pick weight 5 by pointer, then move with the arrow keys.
  await cells.nth(5).click();
  await expect(q8.locator(".q8-readout")).toContainText("Weight 5");
  await page.keyboard.press("ArrowDown");
  await expect(cells.nth(13)).toBeFocused();
  await expect(q8.locator(".q8-readout")).toContainText("Weight 13");

  // Making it an outlier raises the scale.
  const scale = q8.locator(".q8-readout dd").nth(4);
  const d = await scale.innerText();
  await expect(q8.getByRole("button", { name: "Reset block" })).toBeDisabled();
  const slider = q8.getByRole("slider");
  const max = (await slider.getAttribute("max")) ?? "1";
  await slider.fill(max);
  await expect(scale).not.toHaveText(d);
  await expect(q8.getByRole("button", { name: "Reset block" })).toBeEnabled();
  await q8.getByRole("button", { name: "Reset block" }).click();
  await expect(scale).toHaveText(d);
});

test("plays the decoding steps when motion is allowed", async ({ page }) => {
  await open(page);
  const decode = page.locator("#decode");
  await decode.getByRole("button", { name: "Replay" }).click();
  await expect(decode.locator(".ds-attn tbody tr")).toHaveCount(1);
  await expect(decode.getByRole("button", { name: "Replay" })).toBeVisible({ timeout: 20_000 });
  await expect(decode.locator(".ds-attn tbody tr")).toHaveCount(13);
});

test("has no horizontal scroll on a 390 px screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});
