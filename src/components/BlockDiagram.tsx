import { useId, type ReactNode } from "react";
import "./BlockDiagram.css";

// Architecture diagrams as blocks and arrows, themed through the tokens. Coordinates are
// viewBox units; the diagram scales to its container, so a portrait layout about 400 units wide
// keeps 14 px titles legible from a phone (about 340 px) to a column of about 460 px. Put it in a
// <Figure> like any other visualization.
//
//   <BlockDiagram height={600} title="..." description="What the diagram shows, in prose.">
//     <Block x={0} y={0} w={400} h={110} title="CPU" sub="RV32IM" group />
//     <Block x={14} y={52} w={68} h={36} title="IF" />
//     <Arrow points={[[48, 110], [48, 150]]} label="fetch" labelAt={[54, 132]} />
//   </BlockDiagram>

interface BlockDiagramProps {
  /** viewBox width; the default suits a portrait diagram that must work on a phone. */
  width?: number;
  height: number;
  /** The diagram's accessible name. */
  title: string;
  /** A prose description of everything the diagram shows: its text alternative. */
  description: string;
  children: ReactNode;
}

export function BlockDiagram({
  width = 400,
  height,
  title,
  description,
  children,
}: BlockDiagramProps) {
  const id = useId();
  return (
    <svg
      className="block-diagram"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby={`${id}title ${id}desc`}
    >
      <title id={`${id}title`}>{title}</title>
      <desc id={`${id}desc`}>{description}</desc>
      {children}
    </svg>
  );
}

interface BlockProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  /** A second line in the mono face: a size, a rate, the main parts. */
  sub?: string;
  /** A container drawn as a frame around other blocks, with its title at the top. */
  group?: boolean;
  /** Where a group's title sits: at the left (default) or centered, e.g. between arrows. */
  groupAlign?: "start" | "middle";
  /** The one block the diagram is about, in the accent. */
  emphasis?: boolean;
}

/** A block: a filled box with a centered title, or a group frame. */
export function Block({
  x,
  y,
  w,
  h,
  title,
  sub,
  group = false,
  groupAlign = "start",
  emphasis = false,
}: BlockProps) {
  const className = group
    ? "block-diagram__group"
    : emphasis
      ? "block-diagram__block block-diagram__block--em"
      : "block-diagram__block";
  const left = group && groupAlign === "start";
  const tx = left ? x + 12 : x + w / 2;
  const anchor = left ? "start" : "middle";
  return (
    <g>
      <rect className={className} x={x} y={y} width={w} height={h} rx={group ? 10 : 6} />
      <text
        className="block-diagram__title"
        x={tx}
        y={group ? y + 20 : y + (sub ? h / 2 - 3 : h / 2 + 5)}
        textAnchor={anchor}
      >
        {title}
      </text>
      {sub && (
        <text
          className="block-diagram__sub"
          x={tx}
          y={group ? y + 36 : y + h / 2 + 14}
          textAnchor={anchor}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

interface ArrowProps {
  /** The path as points, usually orthogonal; the head is drawn at the last one. */
  points: [number, number][];
  label?: string;
  labelAt?: [number, number];
  labelAnchor?: "start" | "middle" | "end";
}

/** A bus, message or signal between blocks, with an arrowhead at its end. */
export function Arrow({ points, label, labelAt, labelAnchor = "start" }: ArrowProps) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!last || !prev) return null;
  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const head = [angle + 2.6, angle - 2.6]
    .map((a) => `${last[0] + 7 * Math.cos(a)},${last[1] + 7 * Math.sin(a)}`)
    .join(" ");
  return (
    <g>
      <polyline
        className="block-diagram__arrow"
        points={points.map((p) => p.join(",")).join(" ")}
      />
      <polygon className="block-diagram__head" points={`${last[0]},${last[1]} ${head}`} />
      {label && labelAt && <Label at={labelAt} anchor={labelAnchor} text={label} />}
    </g>
  );
}

/** A free-standing label in the mono face, for a note that belongs to no single arrow. */
export function Label({
  at,
  text,
  anchor = "start",
}: {
  at: [number, number];
  text: string;
  anchor?: "start" | "middle" | "end";
}) {
  return (
    <text className="block-diagram__label" x={at[0]} y={at[1]} textAnchor={anchor}>
      {text}
    </text>
  );
}
