"use client";

import { useEffect, useState } from "react";

const THEME_KEY = "innovatepam-theme";
type Theme = "light" | "dark";

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.dataset["theme"] = theme;
}

/**
 * Client hook that owns the active theme. Initial value reads
 * `localStorage` then falls back to `prefers-color-scheme`. Calling
 * `setTheme` updates both the DOM class and `localStorage`.
 */
export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_KEY) as Theme | null;
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const initial: Theme = stored ?? (prefersDark ? "dark" : "light");
      setThemeState(initial);
      applyTheme(initial);
    } catch {
      /* ignore — SSR-safe fallback */
    }
  }, []);

  function setTheme(t: Theme): void {
    setThemeState(t);
    applyTheme(t);
    try {
      window.localStorage.setItem(THEME_KEY, t);
    } catch {
      /* ignore quota errors */
    }
  }

  return {
    theme,
    setTheme,
    toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
  };
}
