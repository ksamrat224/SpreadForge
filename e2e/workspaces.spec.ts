import { test, expect } from "@playwright/test";

test("desktop ranked workspace and challenge selection", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/app");
  await expect(
    page.getByRole("heading", { name: "Quote & Risk" })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: "test-results/spreadforge-desktop.png",
    animations: "disabled",
    fullPage: true,
  });
  await expect(
    page.getByRole("button", { name: "Start ranked run" })
  ).toBeDisabled();
  await expect(
    page.getByText(/Connect a wallet to approve a ranked run/)
  ).toBeVisible();
  await expect(
    page.getByText(/Choose your parameters and approve a run/)
  ).toBeVisible();
  await page.getByRole("button", { name: "Choose challenge" }).click();
  await page.getByRole("button", { name: /Flash Crash & Recovery/ }).click();
  await expect(
    page.getByRole("heading", { name: "Flash Crash & Recovery", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).not.toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).not.toHaveClass("dark");
  expect(errors).toEqual([]);
});

test("paper desk and rankings", async ({ page }) => {
  await page.goto("/app");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Paper Trading" }).click();
  await expect(
    page.getByRole("region", { name: "Paper Trading" })
  ).toBeVisible();
  await expect(page.getByLabel("Price feed")).toHaveCount(0);
  await expect(
    page
      .getByText(/Pyth live|Feed loading|Feed unavailable|Exchange fallback/)
      .first()
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/spreadforge-paper.png",
    animations: "disabled",
    fullPage: true,
  });
  await nav.getByRole("button", { name: "Leaderboard" }).click();
  await expect(
    page.getByRole("heading", { name: "Strategy leaderboard" })
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/spreadforge-leaderboard.png",
    animations: "disabled",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Paper trading", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Paper trading leaderboard" })
  ).toBeVisible();
});

test("portfolio is available in desktop navigation", async ({ page }) => {
  await page.goto("/app");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Portfolio" }).click();
  await expect(page.getByRole("region", { name: "Portfolio" })).toBeVisible();
  await expect(page.getByText("Your paper portfolio.")).toBeVisible();
});

test("mobile navigation, drawer, wallet and horizontal layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/app");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" })
  ).toBeVisible();
  const strategyOverflow = await page
    .locator("body *")
    .evaluateAll((elements) =>
      elements
        .filter(
          (element) => element.getBoundingClientRect().right > innerWidth + 1
        )
        .map((element) => `${element.tagName}.${element.className}`)
        .slice(0, 12)
    );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    `Strategy Lab horizontal overflow: ${strategyOverflow.join(", ")}`
  ).toBe(true);
  await page.screenshot({
    path: "test-results/spreadforge-mobile.png",
    animations: "disabled",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Choose challenge" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Connect a wallet" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Paper Trading" })
    .click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page
    .getByRole("navigation", { name: "Mobile navigation" })
    .getByRole("button", { name: "Portfolio" })
    .click();
  await expect(page.getByRole("region", { name: "Portfolio" })).toBeVisible();
});

test("tablet and small mobile layouts fit the viewport", async ({ page }) => {
  await page.goto("/app");
  for (const width of [320, 768, 820, 1024, 1200, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    const overflowing = await page.locator("body *").evaluateAll((elements) =>
      elements
        .filter(
          (element) => element.getBoundingClientRect().right > innerWidth + 1
        )
        .map((element) => element.tagName + "." + element.className)
        .slice(0, 12)
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth
      ),
      `horizontal overflow at ${width}px: ${overflowing.join(", ")}`
    ).toBe(true);
  }
  await page.setViewportSize({ width: 1024, height: 1000 });
  await page.screenshot({
    path: "test-results/spreadforge-tablet.png",
    fullPage: true,
    animations: "disabled",
  });
});
