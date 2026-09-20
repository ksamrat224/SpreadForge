"use client";
import { IconSun, IconFlame } from "@tabler/icons-react";
import { useSpreadForgeTheme } from "./theme-context";
export function ThemeToggle() {
  const { theme, toggleTheme } = useSpreadForgeTheme();
  return (
    <button
      className="icon-button"
      onClick={toggleTheme}
      aria-label="Toggle theme"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? <IconSun size={17} /> : <IconFlame size={17} />}
    </button>
  );
}
