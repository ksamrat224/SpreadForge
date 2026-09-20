import { test, expect } from "@playwright/test";

test("desktop workspace, challenge completion, and local verification", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Quote & Risk" })
  ).toBeVisible();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: "/tmp/spreadforge-desktop.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "5×" }).click();
  await page.getByRole("button", { name: "Start Challenge" }).click();
  await expect(
    page.getByRole("dialog", { name: "Session debrief" })
  ).toBeVisible({ timeout: 15000 });
  await page.screenshot({
    path: "/tmp/spreadforge-results.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Verify on Solana" }).click();
  await expect(page.getByText(/Result hashed locally/)).toBeVisible();
  await page.getByRole("button", { name: "Run again" }).click();
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

test("paper trades, quote cancellation, rankings and architecture preview", async ({
  page,
}) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Primary navigation" });
  await nav.getByRole("button", { name: "Paper Trading" }).click();
  await page.getByRole("button", { name: /Buy 1 SOL/ }).click();
  await expect(page.getByText("11.00 SOL", { exact: true })).toBeVisible();
  await page.getByLabel("Limit price", { exact: true }).fill("100");
  await page.getByLabel("Size", { exact: true }).fill("0.5");
  await page.getByRole("button", { name: "Place buy quote" }).click();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true })
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.screenshot({ path: "/tmp/spreadforge-paper.png", fullPage: true });
  await nav.getByRole("button", { name: "Leaderboard" }).click();
  await expect(
    page.getByRole("heading", { name: "The Liquidity Gauntlet" })
  ).toBeVisible();
  await page.screenshot({
    path: "/tmp/spreadforge-leaderboard.png",
    fullPage: true,
  });
  await nav.getByRole("button", { name: "MagicBlock" }).click();
  await page.getByRole("button", { name: "Simulate session" }).click();
  await expect(
    page.getByText(
      "Demo complete. No account was created and no transaction was sent."
    )
  ).toBeVisible({ timeout: 10000 });
  await page.screenshot({
    path: "/tmp/spreadforge-architecture.png",
    fullPage: true,
  });
});

test("mobile navigation, drawer, wallet and horizontal layout", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Mobile navigation" })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/spreadforge-mobile.png",
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
});
