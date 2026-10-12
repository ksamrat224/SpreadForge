import { test, expect } from "@playwright/test";

test("paper chart supports crosshair, wheel zoom, drag, intervals and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app");
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Paper Trading" })
    .click();
  await page.locator(".paper-chart-trigger").click();
  await page
    .getByRole("listbox", { name: "Paper trading chart view" })
    .getByRole("option", { name: "Candles" })
    .click();
  const widget = page.locator(".market-chart-widget:visible");
  await expect(widget.locator("canvas").first()).toBeVisible();
  await expect(widget.getByLabel("Chart values")).toContainText("O ");
  const plot = widget.locator(".market-chart-canvas");
  const box = (await plot.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  const before = await widget.getByLabel("Chart values").textContent();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.5);
  await expect(widget.getByLabel("Chart values")).not.toHaveText(before!);
  await page.mouse.wheel(0, -400);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.5, {
    steps: 12,
  });
  await page.mouse.up();
  await widget.getByRole("button", { name: "Fit", exact: true }).click();
  await widget
    .getByRole("combobox", { name: "Candle interval" })
    .selectOption("15");
  for (const view of ["ohlc", "heikin", "area", "line"]) {
    await page.locator(".paper-chart-trigger").click();
    await page
      .getByRole("listbox", { name: "Paper trading chart view" })
      .getByRole("option", { name: new RegExp(view, "i") })
      .click();
    await expect(widget.locator("canvas").first()).toBeVisible();
  }
  await page.locator(".paper-chart-trigger").click();
  await page
    .getByRole("listbox", { name: "Paper trading chart view" })
    .getByRole("option", { name: "Candles" })
    .click();
  await page.screenshot({ path: "test-results/interactive-paper-chart.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test("ranked lab shows on-chain controls without browser simulation", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app");
  await expect(
    page.getByRole("button", { name: "Start ranked run" })
  ).toBeDisabled();
  await expect(page.getByText(/Program-calculated results only/)).toBeVisible();
  await expect(page.getByText(/TICK/).first()).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(
    page.getByText(/Choose your parameters and approve a run/)
  ).toBeVisible();
  await page.screenshot({ path: "test-results/interactive-lab-chart.png" });
  expect(errors).toEqual([]);
});
