import { Arrow, Block, BlockDiagram } from "../../components/BlockDiagram";

const DESCRIPTION =
  "An ONNX model with static shapes is imported, mapping 82 ONNX operators onto Tessera's 50. " +
  "Graph passes fold BatchNorm, recognize LayerNorm and GELU and move images to NHWC. Fusion " +
  "groups the operators into kernels and a memory plan puts every intermediate in one arena. " +
  "Each group is lowered to a loop IR of blocks and scheduled by a template, with a " +
  "configuration from the autotuner's logs. The C backend prints C with NEON and SME " +
  "microkernels; the Metal backend prints Metal Shading Language.";

const MAIN = { x: 0, w: 250 };
const ROW = 76;
const H = 44;
const STAGES: [string, string][] = [
  ["ONNX model", "static input shapes"],
  ["Import", "82 ONNX ops onto 50"],
  ["Graph passes", "fold, LayerNorm, GELU, NHWC"],
  ["Fuse, plan memory", "one kernel per group"],
  ["Lower each group", "a loop IR of blocks"],
];
const SCHEDULE_Y = STAGES.length * ROW;
const BACKEND_Y = SCHEDULE_Y + H + 46;
const CX = MAIN.x + MAIN.w / 2;

/** Tessera's stages, from an ONNX model to C or Metal. */
export function Architecture() {
  return (
    <BlockDiagram
      height={BACKEND_Y + H}
      title="Tessera's compiler pipeline"
      description={DESCRIPTION}
    >
      {STAGES.map(([title, sub], i) => (
        <Block key={title} x={MAIN.x} y={i * ROW} w={MAIN.w} h={H} title={title} sub={sub} />
      ))}
      {STAGES.map(([title], i) => (
        <Arrow
          key={title}
          points={[
            [CX, i * ROW + H],
            [CX, (i + 1) * ROW - 4],
          ]}
        />
      ))}
      <Block
        x={MAIN.x}
        y={SCHEDULE_Y}
        w={MAIN.w}
        h={H}
        title="Schedule"
        sub="template + config"
        emphasis
      />
      <Block x={274} y={SCHEDULE_Y} w={126} h={H} title="Autotuner" sub="tuned configs" />
      <Arrow
        points={[
          [274, SCHEDULE_Y + H / 2],
          [MAIN.w + 4, SCHEDULE_Y + H / 2],
        ]}
      />
      <Block x={0} y={BACKEND_Y} w={190} h={H} title="C backend" sub="NEON, SME kernels" />
      <Block x={210} y={BACKEND_Y} w={190} h={H} title="Metal backend" sub="MSL, SIMD groups" />
      <Arrow
        points={[
          [CX, SCHEDULE_Y + H],
          [CX, BACKEND_Y - 22],
          [95, BACKEND_Y - 22],
          [95, BACKEND_Y - 4],
        ]}
      />
      <Arrow
        points={[
          [CX, SCHEDULE_Y + H],
          [CX, BACKEND_Y - 22],
          [305, BACKEND_Y - 22],
          [305, BACKEND_Y - 4],
        ]}
      />
    </BlockDiagram>
  );
}
