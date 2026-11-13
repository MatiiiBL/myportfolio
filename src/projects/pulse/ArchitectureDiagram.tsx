import { Arrow, Block, BlockDiagram } from "../../components/BlockDiagram";

const STAGES = ["IF", "ID", "EX", "MEM", "WB"];

const DESCRIPTION =
  "A five-stage RV32IM CPU fetches from a 64 KiB instruction memory and reaches the rest of the " +
  "chip through an address decoder: port A of the 256 KiB data memory (four word-interleaved " +
  "banks), the UART and LEDs, and the NPU's registers. The NPU's DMA owns port B of the data " +
  "memory and moves 16 bytes per cycle into the operand buffers, which feed the 8 × 8 array; the " +
  "write-back stage adds the bias, requantizes and applies ReLU, and writes C back through the DMA.";

/** The Pulse SoC as blocks and buses. */
export function ArchitectureDiagram() {
  return (
    <BlockDiagram height={612} title="Pulse system-on-chip block diagram" description={DESCRIPTION}>
      <Block x={0} y={0} w={400} h={104} title="CPU · rv32_core" sub="RV32IM, in order" group />
      {STAGES.map((s, i) => (
        <Block key={s} x={14 + i * 76} y={52} w={68} h={36} title={s} />
      ))}

      <Block x={0} y={150} w={96} h={52} title="IMEM" sub="64 KiB" />
      <Block x={126} y={150} w={150} h={52} title="Address decoder" sub="addr[31:28]" />
      <Block x={306} y={150} w={94} h={52} title="MMIO" sub="UART · LEDs" />
      <Arrow
        points={[
          [48, 104],
          [48, 150],
        ]}
        label="fetch"
        labelAt={[54, 132]}
      />
      <Arrow
        points={[
          [201, 104],
          [201, 150],
        ]}
        label="data"
        labelAt={[207, 132]}
      />
      <Arrow
        points={[
          [276, 176],
          [306, 176],
        ]}
      />

      <Block
        x={0}
        y={252}
        w={290}
        h={96}
        title="DMEM · 256 KiB"
        sub="4 banks, true dual-port"
        group
      />
      {[0, 1, 2, 3].map((b) => (
        <Block key={b} x={12 + b * 68} y={298} w={62} h={36} title={`bank ${b}`} />
      ))}
      <Arrow
        points={[
          [201, 202],
          [201, 252],
        ]}
        label="port A · 32 bit"
        labelAt={[207, 242]}
      />
      <Arrow
        points={[
          [256, 202],
          [256, 222],
          [345, 222],
          [345, 428],
        ]}
        label="registers"
        labelAt={[264, 216]}
      />

      <Block x={0} y={394} w={400} h={218} title="NPU · npu_top" group />
      <Block x={12} y={428} w={180} h={44} title="DMA" sub="one block per cycle" />
      <Block x={208} y={428} w={180} h={44} title="Registers" sub="sequencer, CYCLES" />
      <Arrow
        points={[
          [140, 348],
          [140, 428],
        ]}
        label="port B · 16 B / cycle"
        labelAt={[146, 376]}
      />
      <Arrow
        points={[
          [208, 450],
          [192, 450],
        ]}
      />

      <Block x={12} y={524} w={112} h={56} title="Buffers" sub="A and B rows" />
      <Block x={140} y={524} w={116} h={56} title="8 × 8 array" sub="INT8 MACs" emphasis />
      <Block x={272} y={524} w={116} h={56} title="Write-back" sub="requant, ReLU" />
      <Arrow
        points={[
          [60, 472],
          [60, 524],
        ]}
      />
      <Arrow
        points={[
          [124, 552],
          [140, 552],
        ]}
      />
      <Arrow
        points={[
          [256, 552],
          [272, 552],
        ]}
      />
      <Arrow
        points={[
          [330, 524],
          [330, 498],
          [170, 498],
          [170, 472],
        ]}
        label="C"
        labelAt={[246, 492]}
      />
    </BlockDiagram>
  );
}
