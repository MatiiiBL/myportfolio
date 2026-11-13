import { useRef } from "react";
import { useWidth } from "../../components/charts/useWidth";
import { Figure } from "../../components/Figure";
import "./Architecture.css";

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  lines: string[];
  kind?: "service";
}

interface Layout {
  width: number;
  height: number;
  boxes: Box[];
  edges: { path: string; dashed?: boolean; arrow?: boolean }[];
}

const H = 64;

function wide(): Layout {
  const row1 = 8;
  const band = 104;
  const row2 = 200;
  const boxes: Box[] = [
    { x: 0, y: row1, w: 104, h: H, title: "arXiv API", lines: ["cs.AR, one", "request per 3 s"] },
    { x: 124, y: row1, w: 140, h: H, title: "Fetch", lines: ["HTML, else PDF;", "quality gate"] },
    {
      x: 284,
      y: row1,
      w: 140,
      h: H,
      title: "Read",
      lines: ["agent with tools:", "sections, search"],
    },
    {
      x: 444,
      y: row1,
      w: 140,
      h: H,
      title: "Verify",
      lines: ["each claim, with", "a verbatim quote"],
    },
    { x: 604, y: row1, w: 136, h: H, title: "Revise", lines: ["failed claims,", "verified again"] },
    {
      x: 124,
      y: band,
      w: 140,
      h: 48,
      title: "SQLite store",
      lines: ["stages, calls, cache"],
      kind: "service",
    },
    {
      x: 284,
      y: band,
      w: 456,
      h: 48,
      title: "Gateway",
      lines: ["AIMD window, token buckets, retries, cache, cost, batches"],
      kind: "service",
    },
    { x: 604, y: row2, w: 136, h: H, title: "Topics", lines: ["TF-IDF, k-means,", "LLM labels"] },
    {
      x: 444,
      y: row2,
      w: 140,
      h: H,
      title: "Synthesis",
      lines: ["one agent per", "topic, citations"],
    },
    {
      x: 284,
      y: row2,
      w: 140,
      h: H,
      title: "Report, site",
      lines: ["Markdown and a", "static site"],
    },
  ];
  const mid = (x: number, w: number) => x + w / 2;
  return {
    width: 760,
    height: row2 + H + 8,
    boxes,
    edges: [
      { path: `M104 40 H120`, arrow: true },
      { path: `M264 40 H280`, arrow: true },
      { path: `M424 40 H440`, arrow: true },
      { path: `M584 40 H600`, arrow: true },
      { path: `M740 40 H754 V232 H744`, arrow: true },
      { path: `M604 232 H588`, arrow: true },
      { path: `M444 232 H428`, arrow: true },
      ...[mid(284, 140), mid(444, 140), mid(604, 136)].map((x) => ({
        path: `M${x} ${band} V${row1 + H}`,
        dashed: true,
      })),
      ...[mid(444, 140), mid(604, 136)].map((x) => ({
        path: `M${x} ${band + 48} V${row2}`,
        dashed: true,
      })),
      { path: `M264 128 H284`, dashed: true },
    ],
  };
}

function narrow(): Layout {
  const main = 196;
  const gap = 22;
  const row = (i: number) => 8 + i * (H + gap);
  const titles: [string, string[]][] = [
    ["arXiv API", ["cs.AR, one", "request per 3 s"]],
    ["Fetch", ["HTML, else PDF;", "quality gate"]],
    ["Read", ["agent with tools:", "sections, search"]],
    ["Verify", ["each claim, with", "a verbatim quote"]],
    ["Revise", ["failed claims,", "verified again"]],
    ["Topics", ["TF-IDF, k-means,", "LLM labels"]],
    ["Synthesis", ["one agent per", "topic, citations"]],
    ["Report, site", ["Markdown and a", "static site"]],
  ];
  const side = main + 24;
  const sideW = 360 - side;
  const boxes: Box[] = titles.map(([title, lines], i) => ({
    x: 0,
    y: row(i),
    w: main,
    h: H,
    title,
    lines,
  }));
  boxes.push(
    {
      x: side,
      y: row(2),
      w: sideW,
      h: row(6) + H - row(2),
      title: "Gateway",
      lines: ["AIMD window,", "token buckets,", "retries, cache,", "cost, batches"],
      kind: "service",
    },
    {
      x: side,
      y: row(0),
      w: sideW,
      h: row(1) + H - row(0),
      title: "SQLite store",
      lines: ["stages, calls,", "cache"],
      kind: "service",
    },
  );
  const edges: Layout["edges"] = titles.slice(1).map((_, i) => ({
    path: `M${main / 2} ${row(i) + H} V${row(i + 1) - 4}`,
    arrow: true,
  }));
  for (const i of [2, 3, 4, 5, 6]) {
    edges.push({ path: `M${side} ${row(i) + H / 2} H${main}`, dashed: true });
  }
  edges.push({ path: `M${side + sideW / 2} ${row(1) + H} V${row(2)}`, dashed: true });
  return { width: 360, height: row(7) + H + 8, boxes, edges };
}

export function Architecture() {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref, 760);
  const layout = width >= 620 ? wide() : narrow();
  return (
    <Figure
      title="From arXiv to a map of the field"
      subtitle="per-paper stages above, corpus stages below · dashed: model calls and records"
      caption={
        <>
          The per-paper stages run for thousands of papers at once. Every model request, from the
          agents and from the corpus stages, goes through the one gateway, which records each call
          and its reply in the SQLite store. Source: the README and{" "}
          <a href="https://github.com/MatiiiBL/precis/blob/main/docs/design.md">docs/design.md</a>.
        </>
      }
    >
      <div ref={ref} className="flow">
        <svg
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width="100%"
          role="img"
          aria-label="Précis's pipeline: papers come from the arXiv API, are fetched and parsed, read by an agent, verified claim by claim and revised when a claim fails; the summaries are clustered into topics, each topic is synthesized, and a report and a static site are written. Every model request goes through one gateway, which records calls and replies in a SQLite store."
          style={{ maxWidth: layout.width }}
        >
          <defs>
            <marker
              id="flow-arrow"
              viewBox="0 0 8 8"
              refX="7"
              refY="4"
              markerWidth="8"
              markerHeight="8"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L8 4 L0 8 z" className="flow-arrowhead" />
            </marker>
          </defs>
          {layout.edges.map((e) => (
            <path
              key={e.path}
              d={e.path}
              className={e.dashed ? "flow-edge is-dashed" : "flow-edge"}
              markerEnd={e.arrow ? "url(#flow-arrow)" : undefined}
            />
          ))}
          {layout.boxes.map((b) => (
            <g
              key={b.title}
              className={b.kind === "service" ? "flow-node is-service" : "flow-node"}
            >
              <rect x={b.x + 0.5} y={b.y + 0.5} width={b.w - 1} height={b.h - 1} rx={8} />
              <text className="flow-title" x={b.x + 12} y={b.y + 21}>
                {b.title}
              </text>
              {b.lines.map((line, i) => (
                <text key={line} className="flow-detail" x={b.x + 12} y={b.y + 38 + i * 14}>
                  {line}
                </text>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </Figure>
  );
}
