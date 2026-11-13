import type { ReactNode } from "react";

// The SoC as blocks and buses, in a portrait layout that stays legible on a phone. Coordinates
// are in viewBox units (400 wide); text sizes assume the diagram is drawn 340-460 px wide.

interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  /** A container drawn as a frame, with its title at the top-left corner. */
  group?: boolean;
  emphasis?: boolean;
}

function Box({ x, y, w, h, title, sub, group = false, emphasis = false }: BoxProps) {
  const className = group ? "arch-group" : emphasis ? "arch-box arch-box--em" : "arch-box";
  return (
    <g>
      <rect className={className} x={x} y={y} width={w} height={h} rx={group ? 10 : 6} />
      <text
        className="arch-title"
        x={group ? x + 12 : x + w / 2}
        y={group ? y + 20 : y + (sub ? h / 2 - 3 : h / 2 + 5)}
        textAnchor={group ? "start" : "middle"}
      >
        {title}
      </text>
      {sub && (
        <text
          className="arch-sub"
          x={group ? x + 12 : x + w / 2}
          y={group ? y + 36 : y + h / 2 + 14}
          textAnchor={group ? "start" : "middle"}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

/** A bus or signal as an orthogonal polyline, with an arrowhead at its last point. */
function Edge({
  points,
  label,
  labelAt,
}: {
  points: [number, number][];
  label?: ReactNode;
  labelAt?: [number, number];
}) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!last || !prev) return null;
  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const head = [angle + 2.6, angle - 2.6]
    .map((a) => `${last[0] + 7 * Math.cos(a)},${last[1] + 7 * Math.sin(a)}`)
    .join(" ");
  return (
    <g>
      <polyline className="arch-edge" points={points.map((p) => p.join(",")).join(" ")} />
      <polygon className="arch-head" points={`${last[0]},${last[1]} ${head}`} />
      {label && labelAt && (
        <text className="arch-label" x={labelAt[0]} y={labelAt[1]}>
          {label}
        </text>
      )}
    </g>
  );
}

const STAGES = ["IF", "ID", "EX", "MEM", "WB"];

export function ArchitectureDiagram() {
  return (
    <svg
      className="arch"
      viewBox="0 0 400 612"
      role="img"
      aria-labelledby="pulse-arch-title pulse-arch-desc"
    >
      <title id="pulse-arch-title">Pulse system-on-chip block diagram</title>
      <desc id="pulse-arch-desc">
        A five-stage RV32IM CPU fetches from a 64 KiB instruction memory and reaches the rest of the
        chip through an address decoder: port A of the 256 KiB data memory (four word-interleaved
        banks), the UART and LEDs, and the NPU&apos;s registers. The NPU&apos;s DMA owns port B of
        the data memory and moves 16 bytes per cycle into the operand buffers, which feed the 8 × 8
        array; the write-back stage adds the bias, requantizes and applies ReLU, and writes C back
        through the DMA.
      </desc>

      <Box x={0} y={0} w={400} h={104} title="CPU · rv32_core" sub="RV32IM, in order" group />
      {STAGES.map((s, i) => (
        <Box key={s} x={14 + i * 76} y={52} w={68} h={36} title={s} />
      ))}

      <Box x={0} y={150} w={96} h={52} title="IMEM" sub="64 KiB" />
      <Box x={126} y={150} w={150} h={52} title="Address decoder" sub="addr[31:28]" />
      <Box x={306} y={150} w={94} h={52} title="MMIO" sub="UART · LEDs" />
      <Edge
        points={[
          [48, 104],
          [48, 150],
        ]}
        label="fetch"
        labelAt={[54, 132]}
      />
      <Edge
        points={[
          [201, 104],
          [201, 150],
        ]}
        label="data"
        labelAt={[207, 132]}
      />
      <Edge
        points={[
          [276, 176],
          [306, 176],
        ]}
      />

      <Box
        x={0}
        y={252}
        w={290}
        h={96}
        title="DMEM · 256 KiB"
        sub="4 banks, true dual-port"
        group
      />
      {[0, 1, 2, 3].map((b) => (
        <Box key={b} x={12 + b * 68} y={298} w={62} h={36} title={`bank ${b}`} />
      ))}
      <Edge
        points={[
          [201, 202],
          [201, 252],
        ]}
        label="port A · 32 bit"
        labelAt={[207, 242]}
      />
      <Edge
        points={[
          [256, 202],
          [256, 222],
          [345, 222],
          [345, 428],
        ]}
        label="registers"
        labelAt={[264, 216]}
      />

      <Box x={0} y={394} w={400} h={218} title="NPU · npu_top" group />
      <Box x={12} y={428} w={180} h={44} title="DMA" sub="one block per cycle" />
      <Box x={208} y={428} w={180} h={44} title="Registers" sub="sequencer, CYCLES" />
      <Edge
        points={[
          [140, 348],
          [140, 428],
        ]}
        label="port B · 16 B / cycle"
        labelAt={[146, 376]}
      />
      <Edge
        points={[
          [208, 450],
          [192, 450],
        ]}
      />

      <Box x={12} y={524} w={112} h={56} title="Buffers" sub="A and B rows" />
      <Box x={140} y={524} w={116} h={56} title="8 × 8 array" sub="INT8 MACs" emphasis />
      <Box x={272} y={524} w={116} h={56} title="Write-back" sub="requant, ReLU" />
      <Edge
        points={[
          [60, 472],
          [60, 524],
        ]}
      />
      <Edge
        points={[
          [124, 552],
          [140, 552],
        ]}
      />
      <Edge
        points={[
          [256, 552],
          [272, 552],
        ]}
      />
      <Edge
        points={[
          [330, 524],
          [330, 498],
          [170, 498],
          [170, 472],
        ]}
        label="C"
        labelAt={[246, 492]}
      />
    </svg>
  );
}
