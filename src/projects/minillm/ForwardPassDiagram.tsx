import { Box } from "../vecdex/ArchitectureDiagram";
import "../vecdex/diagrams.css";

const W = 360;
const H = 42;
const GAP = 18;

interface Stage {
  title: string;
  sub: string;
}

const BEFORE: Stage[] = [{ title: "embedding", sub: "token ids [n] → h [n, 576]" }];
const LAYER: Stage[] = [
  { title: "RMSNorm → q, k, v", sub: "q [n, 9 × 64]; k, v [n, 3 × 64]" },
  { title: "RoPE → KV cache", sub: "θ = 100,000; k, v projected into the cache" },
  { title: "attention", sub: "9 query heads over 3 KV heads, causal" },
  { title: "o_proj, + residual", sub: "h [n, 576]" },
  { title: "RMSNorm → SwiGLU MLP", sub: "gate, up [n, 1536] → down [n, 576], + h" },
];
const AFTER: Stage[] = [
  { title: "RMSNorm → LM head", sub: "tied to the embedding; last row → [49152]" },
  { title: "sampler", sub: "greedy, or temperature, top-k, top-p" },
];

const FRAME_TOP = GAP + H + GAP;
const FRAME_HEIGHT = 30 + LAYER.length * (H + 8) + 4;
const AFTER_TOP = FRAME_TOP + FRAME_HEIGHT + GAP;
const HEIGHT = AFTER_TOP + AFTER.length * (H + GAP) - GAP + 4;

function Arrow({ y1, y2 }: { y1: number; y2: number }) {
  return (
    <line className="dg-link" x1={W / 2} y1={y1} x2={W / 2} y2={y2} markerEnd="url(#ml-arrow)" />
  );
}

/** One forward pass of SmolLM2-135M through minillm, with the shapes of each stage. */
export function ForwardPassDiagram() {
  return (
    <figure className="dg">
      <svg
        viewBox={`0 0 ${W} ${HEIGHT}`}
        role="img"
        aria-labelledby="ml-fwd-title ml-fwd-desc"
        className="dg-svg"
      >
        <title id="ml-fwd-title">One forward pass</title>
        <desc id="ml-fwd-desc">
          Token ids are embedded into 576-wide rows. Each of 30 layers normalizes them, projects
          queries for 9 heads and keys and values for 3, rotates queries and keys with RoPE, writes
          keys and values into the cache, attends causally, adds the output projection to the
          residual, and applies a SwiGLU MLP of width 1536. A final norm and the LM head, which
          reuses the embedding table, give the last token&apos;s 49,152 logits, and the sampler
          picks the next token.
        </desc>
        <defs>
          <marker
            id="ml-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0 0 L8 4 L0 8 z" className="dg-arrowhead" />
          </marker>
        </defs>

        {BEFORE.map((s) => (
          <Box key={s.title} x={16} y={GAP / 2} w={W - 32} h={H} title={s.title} sub={s.sub} />
        ))}
        <Arrow y1={GAP / 2 + H} y2={FRAME_TOP - 2} />

        <rect
          className="dg-frame"
          x={8}
          y={FRAME_TOP}
          width={W - 16}
          height={FRAME_HEIGHT}
          rx={10}
        />
        <text className="dg-kicker" x={20} y={FRAME_TOP + 20}>
          × 30 LAYERS
        </text>
        {LAYER.map((s, i) => (
          <Box
            key={s.title}
            x={16}
            y={FRAME_TOP + 30 + i * (H + 8)}
            w={W - 32}
            h={H}
            title={s.title}
            sub={s.sub}
          />
        ))}
        <Arrow y1={FRAME_TOP + FRAME_HEIGHT} y2={AFTER_TOP - 2} />

        {AFTER.map((s, i) => (
          <g key={s.title}>
            <Box
              x={16}
              y={AFTER_TOP + i * (H + GAP)}
              w={W - 32}
              h={H}
              title={s.title}
              sub={s.sub}
            />
            {i < AFTER.length - 1 && (
              <Arrow y1={AFTER_TOP + i * (H + GAP) + H} y2={AFTER_TOP + (i + 1) * (H + GAP) - 2} />
            )}
          </g>
        ))}
      </svg>
    </figure>
  );
}
