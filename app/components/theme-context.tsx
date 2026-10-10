"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
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
  const [theme, setTheme] = useState<Theme>("dark");
  // The default must not be written over the saved preference before it has
  // been read back, which React's double-invoked effects would do in dev.
  const restored = useRef(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem(STORAGE_KEY);
    const timer = window.setTimeout(() => {
      restored.current = true;
      if (savedTheme === "light" || savedTheme === "dark") {
        setTheme(savedTheme);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    if (restored.current) localStorage.setItem(STORAGE_KEY, theme);
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
