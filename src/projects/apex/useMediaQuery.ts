import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync with the browser. The server render (and the
 * prerendered HTML) assumes it does not match.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
