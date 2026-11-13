import { Arrow, Block, BlockDiagram, Label } from "../../components/BlockDiagram";

const DESCRIPTION =
  "Papers come from the arXiv API and are fetched and parsed into sections, from arXiv's HTML " +
  "or, failing that, the PDF. For each paper, thousands at once, a reader agent writes a " +
  "summary, a critic verifies each claim with a quote, and a reviser rewrites failed claims, " +
  "which are verified again. The summaries are clustered into topics, each topic is " +
  "synthesized, and a report and a static site are written. Every model request, from the " +
  "agents and from the topic and synthesis stages, goes through one gateway, which records " +
  "each call and its reply in a SQLite store.";

const H = 44;
const MAIN_W = 260;
const CX = MAIN_W / 2;
const SIDE = { x: 290, w: 110 };

const GROUP_Y = 148;
const AGENTS: [string, string][] = [
  ["Read", "agent with tools"],
  ["Verify", "each claim, a quote"],
  ["Revise", "failed claims only"],
];
const agentY = (i: number) => GROUP_Y + 34 + i * 68;
const GROUP_H = agentY(AGENTS.length - 1) + H + 16 - GROUP_Y;
const CORPUS_Y = GROUP_Y + GROUP_H + 30;
const CORPUS: [string, string][] = [
  ["Topics", "TF-IDF, k-means"],
  ["Synthesis", "one agent per topic"],
  ["Report, site", "Markdown, static HTML"],
];
const corpusY = (i: number) => CORPUS_Y + i * 68;
const BOTTOM = corpusY(CORPUS.length - 1) + H;
const GATEWAY = { y: agentY(0), h: corpusY(1) + H - agentY(0) };

/** Précis's stages, the gateway every model request goes through, and the store. */
export function Architecture() {
  return (
    <BlockDiagram height={BOTTOM} title="Précis's pipeline" description={DESCRIPTION}>
      <Block x={0} y={0} w={MAIN_W} h={H} title="arXiv API" sub="one request every 3 s" />
      <Block x={0} y={74} w={MAIN_W} h={H} title="Fetch" sub="HTML, else PDF; quality gate" />
      <Arrow
        points={[
          [CX, H],
          [CX, 70],
        ]}
      />
      <Block x={0} y={GROUP_Y} w={MAIN_W} h={GROUP_H} title="Per paper, thousands at once" group />
      <Arrow
        points={[
          [CX, 74 + H],
          [CX, agentY(0) - 4],
        ]}
      />
      {AGENTS.map(([title, sub], i) => (
        <Block key={title} x={14} y={agentY(i)} w={MAIN_W - 28} h={H} title={title} sub={sub} />
      ))}
      {AGENTS.slice(1).map(([title], i) => (
        <Arrow
          key={title}
          points={[
            [CX, agentY(i) + H],
            [CX, agentY(i + 1) - 4],
          ]}
        />
      ))}
      <Label at={[CX + 8, agentY(2) - 10]} text="if a claim fails" />
      {CORPUS.map(([title, sub], i) => (
        <Block key={title} x={0} y={corpusY(i)} w={MAIN_W} h={H} title={title} sub={sub} />
      ))}
      <Arrow
        points={[
          [CX, GROUP_Y + GROUP_H],
          [CX, CORPUS_Y - 4],
        ]}
      />
      {CORPUS.slice(1).map(([title], i) => (
        <Arrow
          key={title}
          points={[
            [CX, corpusY(i) + H],
            [CX, corpusY(i + 1) - 4],
          ]}
        />
      ))}
      <Block
        x={SIDE.x}
        y={GATEWAY.y}
        w={SIDE.w}
        h={GATEWAY.h}
        title="Gateway"
        sub="every request"
        emphasis
      />
      {[
        ...AGENTS.map((_, i) => [MAIN_W - 14, agentY(i)] as const),
        ...[0, 1].map((i) => [MAIN_W, corpusY(i)] as const),
      ].map(([x, y]) => (
        <Arrow
          key={y}
          points={[
            [x, y + H / 2],
            [SIDE.x - 4, y + H / 2],
          ]}
        />
      ))}
      <Block x={SIDE.x} y={corpusY(2)} w={SIDE.w} h={H} title="Store" sub="SQLite" />
      <Arrow
        points={[
          [SIDE.x + SIDE.w / 2, GATEWAY.y + GATEWAY.h],
          [SIDE.x + SIDE.w / 2, corpusY(2) - 4],
        ]}
      />
    </BlockDiagram>
  );
}
