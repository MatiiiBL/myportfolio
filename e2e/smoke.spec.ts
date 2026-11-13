import { expect, test } from "@playwright/test";

test("the home page lists every project", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Matías Blanco");
  await expect(page.getByRole("link", { name: "Apex" })).toBeVisible();
});
