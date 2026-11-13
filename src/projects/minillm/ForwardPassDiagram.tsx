import { Arrow, Block, BlockDiagram } from "../../components/BlockDiagram";

const H = 50;
const GAP = 26;

const LAYER = [
  { title: "RMSNorm → q, k, v", sub: "q [n, 9×64]; k, v [n, 3×64]" },
  { title: "RoPE → KV cache", sub: "θ = 100,000; k, v written in place" },
  { title: "attention", sub: "9 query heads over 3 KV heads" },
  { title: "o_proj, + residual", sub: "h [n, 576]" },
  { title: "RMSNorm → SwiGLU MLP", sub: "[n, 1536] → [n, 576], + h" },
];
const AFTER = [
  { title: "RMSNorm → LM head", sub: "tied embedding; last row → [49152]" },
  { title: "sampler", sub: "greedy, or temperature, top-k, top-p" },
];

const GROUP_TOP = H + GAP;
const GROUP_HEIGHT = 34 + LAYER.length * (H + 8) + 6;
const AFTER_TOP = GROUP_TOP + GROUP_HEIGHT + GAP;
const HEIGHT = AFTER_TOP + AFTER.length * H + (AFTER.length - 1) * GAP + 2;

function down(y1: number, y2: number) {
  return (
    <Arrow
      points={[
        [200, y1],
        [200, y2 - 2],
      ]}
    />
  );
}

/** One forward pass of SmolLM2-135M through minillm, with the shapes of each stage. */
export function ForwardPassDiagram() {
  return (
    <BlockDiagram
      height={HEIGHT}
      title="One forward pass of SmolLM2-135M"
      description={
        "Token ids are embedded into 576-wide rows. Each of 30 layers normalizes them, " +
        "projects queries for 9 heads and keys and values for 3, rotates queries and keys " +
        "with RoPE, writes keys and values into the cache, attends causally, adds the output " +
        "projection to the residual, and applies a SwiGLU MLP of width 1536. A final norm and " +
        "the LM head, which reuses the embedding table, give the last token's 49,152 logits, " +
        "and the sampler picks the next token."
      }
    >
      <Block x={0} y={0} w={400} h={H} title="embedding" sub="token ids [n] → h [n, 576]" />
      {down(H, GROUP_TOP)}
      <Block x={0} y={GROUP_TOP} w={400} h={GROUP_HEIGHT} title="× 30 layers" group />
      {LAYER.map((s, i) => (
        <Block
          key={s.title}
          x={14}
          y={GROUP_TOP + 34 + i * (H + 8)}
          w={372}
          h={H}
          title={s.title}
          sub={s.sub}
          emphasis={s.title === "attention"}
        />
      ))}
      {down(GROUP_TOP + GROUP_HEIGHT, AFTER_TOP)}
      {AFTER.map((s, i) => (
        <g key={s.title}>
          <Block x={0} y={AFTER_TOP + i * (H + GAP)} w={400} h={H} title={s.title} sub={s.sub} />
          {i < AFTER.length - 1 &&
            down(AFTER_TOP + i * (H + GAP) + H, AFTER_TOP + (i + 1) * (H + GAP))}
        </g>
      ))}
    </BlockDiagram>
  );
}
