import { test, expect } from "@playwright/test";

test("paper chart supports crosshair, wheel zoom, drag, intervals and mobile layout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "Paper Trading" })
    .click();
  await page
    .getByRole("combobox", { name: "Paper trading chart view" })
    .selectOption("candles");
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
    await page
      .getByRole("combobox", { name: "Paper trading chart view" })
      .selectOption(view);
    await expect(widget.locator("canvas").first()).toBeVisible();
  }
  await page
    .getByRole("combobox", { name: "Paper trading chart view" })
    .selectOption("candles");
  await page.screenshot({ path: "test-results/interactive-paper-chart.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
    )
    .toBe(true);
  expect(errors).toEqual([]);
});

test("lab chart renders during simulation and survives resets and theme changes", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("combobox", { name: "Chart view", exact: true })
    .selectOption("candles");
  const widget = page.locator(".market-chart-widget:visible");
  await page.getByRole("button", { name: "5×" }).click();
  await page.getByRole("button", { name: "Start Challenge" }).click();
  await expect(widget.getByLabel("Chart values")).not.toContainText("T0 ");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await widget.getByRole("button", { name: "Zoom in chart" }).click();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(widget.locator("canvas").first()).toBeVisible();
  await page.screenshot({ path: "test-results/interactive-lab-chart.png" });
  await page.getByRole("button", { name: "Reset simulation" }).click();
  await expect(widget.getByLabel("Chart values")).toContainText("T0 ");
  expect(errors).toEqual([]);
});
