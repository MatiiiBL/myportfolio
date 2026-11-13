import { useSyncExternalStore } from "react";
import { currentTheme, nextTheme, setTheme, subscribeTheme, type Theme } from "./theme";

const NAMES: Record<Theme, string> = { system: "system", dark: "dark", light: "light" };

/**
 * Cycles the color theme: system → dark → light. All three icons are rendered and CSS shows the
 * one matching data-theme on <html>, so the button is right from the first paint, before React
 * has read the saved choice.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "system" as const);
  const next = nextTheme(theme);
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(next)}
      aria-label={`Theme: ${NAMES[theme]}. Switch to ${NAMES[next]}.`}
      title={`Theme: ${NAMES[theme]}`}
    >
      <svg className="theme-icon is-system" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="6" />
        <path d="M8 2a6 6 0 0 1 0 12z" className="fill" />
      </svg>
      <svg className="theme-icon is-dark" viewBox="0 0 16 16" aria-hidden="true">
        <path d="M13.5 9.6A5.6 5.6 0 0 1 6.4 2.5a5.6 5.6 0 1 0 7.1 7.1z" className="fill" />
      </svg>
      <svg className="theme-icon is-light" viewBox="0 0 16 16" aria-hidden="true">
        <circle cx="8" cy="8" r="3" className="fill" />
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6 13 13M3 13l1.4-1.4M11.6 4.4 13 3" />
      </svg>
    </button>
  );
}
