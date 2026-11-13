import { useSyncExternalStore } from "react";

const LIGHT = "(prefers-color-scheme: light)";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia(LIGHT);
  media.addEventListener("change", onChange);
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    media.removeEventListener("change", onChange);
    observer.disconnect();
  };
}

/**
 * A key that changes whenever the theme may have changed (the system preference or the
 * visitor's choice), for canvas drawings that read the color tokens when they draw.
 */
export function useThemeKey(): string {
  return useSyncExternalStore(
    subscribe,
    () => `${document.documentElement.dataset.theme ?? ""}${window.matchMedia(LIGHT).matches}`,
    () => "",
  );
}
