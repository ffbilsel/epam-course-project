"use client";

import { useTheme } from "@/lib/hooks/use-theme";
import { Button } from "@/components/ui/button";

/**
 * Compact dark-mode toggle. Reads the active theme from
 * {@link useTheme} and flips it on click.
 */
export function ThemeToggle(): JSX.Element {
  const { theme, toggle } = useTheme();
  const next = theme === "dark" ? "light" : "dark";
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Switch to ${next} mode`}
      onClick={toggle}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
      <span className="ml-2 hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span>
    </Button>
  );
}
