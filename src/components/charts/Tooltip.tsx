import { useLayoutEffect, useRef } from "react";
import { seriesColor, type TooltipStop } from "./types";

interface TooltipProps {
  stop: TooltipStop;
  /** Drawing size, to keep the tooltip inside the plot. */
  width: number;
  height: number;
}

const OFFSET = 14;

/**
 * The readout for one position: every series' value there, values first. It sits beside the
 * anchor, on whichever side has room, and never leaves the plot. Screen readers get the same
 * text from ChartFrame's live region, so this element is hidden from them.
 */
export function Tooltip({ stop, width, height }: TooltipProps) {
  const ref = useRef<HTMLDivElement>(null);

  // The tooltip's own size is only known once it is laid out, so it is placed afterwards.
  useLayoutEffect(() => {
    const el = ref.current;
    const plot = el?.parentElement;
    if (!el || !plot) return;
    const scale = plot.clientWidth / width;
    const x = stop.x * scale;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const right = x + OFFSET;
    const left = x - OFFSET - w;
    const fitsRight = right + w <= plot.clientWidth;
    const fitsLeft = left >= 0;
    const prefersLeft = stop.x > width * 0.55;
    const chosen = (prefersLeft && fitsLeft) || !fitsRight ? left : right;
    el.style.left = `${Math.max(0, Math.min(chosen, plot.clientWidth - w))}px`;
    el.style.top = `${Math.max(0, Math.min(stop.y * scale - h / 2, height - h))}px`;
    el.style.visibility = "visible";
  }, [stop, width, height]);

  return (
    <div ref={ref} className="chart-tooltip" aria-hidden="true">
      <p className="chart-tooltip-title">{stop.title}</p>
      <ul>
        {stop.rows.map((row) => (
          <li key={row.label}>
            <span
              className="chart-tooltip-key"
              style={{ background: seriesColor(row.color) }}
              data-mark={row.mark}
            />
            <strong>{row.value}</strong>
            <span className="chart-tooltip-label">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
