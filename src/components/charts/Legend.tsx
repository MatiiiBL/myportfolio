import { seriesColor, type LegendItem, type SeriesColor } from "./types";

/** The series key: the label in text color beside a mark in the series color. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="chart-legend" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label}>
          <SeriesKey color={item.color} mark={item.mark} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}

/** A short line with a dot for line series, a small rounded square for bars. */
export function SeriesKey({ color, mark }: { color: SeriesColor; mark: "line" | "bar" }) {
  const c = seriesColor(color);
  return (
    <svg className="chart-key" width="18" height="10" viewBox="0 0 18 10" aria-hidden="true">
      {mark === "line" ? (
        <>
          <line x1="1" y1="5" x2="17" y2="5" style={{ stroke: c }} strokeWidth="2" />
          <circle cx="9" cy="5" r="3" style={{ fill: c }} />
        </>
      ) : (
        <rect x="4" y="0" width="10" height="10" rx="2" style={{ fill: c }} />
      )}
    </svg>
  );
}
