import { useLayoutEffect, useState, type RefObject } from "react";

/**
 * The content width of an element, tracked with a ResizeObserver. Until the first measurement
 * (and in the prerendered HTML) it is `fallback`, so the server and the first client render
 * agree and hydration does not mismatch.
 */
export function useWidth(ref: RefObject<HTMLElement | null>, fallback: number): number {
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}
