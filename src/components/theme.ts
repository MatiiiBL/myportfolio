// The visitor's color theme. "system" follows prefers-color-scheme; "dark" and "light" are a
// choice saved in localStorage. index.html applies the saved choice before the first paint (so
// there is no flash of the wrong theme) by setting data-theme on <html>, which tokens.css reads.

export type Theme = "system" | "dark" | "light";

export const THEME_KEY = "theme";
const ORDER: Theme[] = ["system", "dark", "light"];
const listeners = new Set<() => void>();

export function currentTheme(): Theme {
  const t = document.documentElement.dataset.theme;
  return t === "dark" || t === "light" ? t : "system";
}

/** The theme after this one in the cycle system → dark → light → system. */
export function nextTheme(theme: Theme): Theme {
  return ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length] ?? "system";
}

export function setTheme(theme: Theme): void {
  const root = document.documentElement;
  try {
    if (theme === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Storage can be unavailable (private mode, blocked cookies); the choice then lasts the visit.
  }
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
  syncThemeColor();
  for (const listener of listeners) listener();
}

/** The page background in each scheme (--bg in tokens.css), as index.html's metas give it. */
const SCHEME_BG = { dark: "#0d1117", light: "#ffffff" } as const;

/**
 * Keeps the browser UI color (theme-color) on the page background. A chosen theme puts both
 * metas on its background; "system" gives each back its own scheme's, so the browser UI follows
 * the system when it changes.
 */
function syncThemeColor(): void {
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
  const system = currentTheme() === "system";
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    meta.content = system ? SCHEME_BG[meta.media.includes("light") ? "light" : "dark"] : bg;
  }
}

export function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
