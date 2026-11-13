import type { Stat as StatData } from "../content/types";
import "./Stat.css";

/** A headline number with its label, as on the profile cards. */
export function Stat({ value, label }: StatData) {
  return (
    <div className="stat">
      <dt className="stat-value">{value}</dt>
      <dd className="stat-label">{label}</dd>
    </div>
  );
}
