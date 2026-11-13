import "./Chip.css";

/** A small rounded tag in the mono face, e.g. a language or tool. */
export function Chip({ children }: { children: string }) {
  return <span className="chip">{children}</span>;
}
