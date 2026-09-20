"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

type Theme = "light" | "dark";

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "spreadforge-theme";

export function SpreadForgeThemeProvider({
  children,
}: {
  children: ReactNode;
}) {
  // Keep the first client render identical to the server render. The saved
  // preference is applied after hydration to avoid a mismatch.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedTheme = localStorage.getItem(STORAGE_KEY);
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () =>
          setTheme((current) => (current === "dark" ? "light" : "dark")),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useSpreadForgeTheme() {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error(
      "useSpreadForgeTheme must be used within SpreadForgeThemeProvider"
    );
  return context;
}
