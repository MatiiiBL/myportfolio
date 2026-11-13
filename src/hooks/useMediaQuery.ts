import { useSyncExternalStore } from "react";

/**
 * Whether a media query matches, kept in sync with the browser: for example
 * `useMediaQuery("(prefers-reduced-motion: reduce)")` or `useMediaQuery("(max-width: 40rem)")`.
 * The server render and the prerendered HTML assume it does not match, so a component renders
 * its default form first and adapts on the client.
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
