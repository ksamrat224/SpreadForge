import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { SpreadForgeThemeProvider } from "./theme-context";
import { ThemeToggle } from "./theme-toggle";

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to the dark terminal theme and toggles light mode", () => {
    render(
      <SpreadForgeThemeProvider>
        <ThemeToggle />
      </SpreadForgeThemeProvider>
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    fireEvent.click(screen.getByLabelText("Toggle theme"));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
