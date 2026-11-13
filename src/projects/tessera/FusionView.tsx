import { useState } from "react";
import { Figure } from "../../components/Figure";
import block from "./data/fusion-block.json";
import "./FusionView.css";

interface Arg {
  name: string;
  shape: number[];
  bytes: number;
  kind: string;
}

interface Kernel {
  name: string;
  pattern: string;
  nodes: string[];
  args: Arg[];
}

const PREFIX = "layer1_layer1_1_";
const MIB = 1024 * 1024;

// Unfused, every node is its own kernel named after it, so those kernels list the block's nodes
// in order; the fused kernels hold the same nodes, consecutively.
const unfused = block.unfused.kernels as Kernel[];
const fused = block.fused.kernels as Kernel[];

function short(name: string): string {
  return name.replace(PREFIX, "").replace(/_(Conv|Relu)$/, "");
}

function label(node: number): string {
  const kernel = unfused[node] as Kernel;
  const op = kernel.nodes[0] ?? "";
  if (op === "Conv2d") {
    const w = kernel.args[1]?.shape ?? [];
    return `${short(kernel.name)} ${w[0]}×${w[1]} conv, ${w[2]}→${w[3]}`;
  }
  return op === "Relu" ? "ReLU" : op;
}

function mib(bytes: number): string {
  return `${(bytes / MIB).toFixed(bytes < 10 * MIB ? 2 : 1)} MiB`;
}

function tensor(arg: Arg): string {
  return `${arg.shape.slice(1).join("×")} (${(arg.bytes / 1024).toLocaleString("en-US")} KiB)`;
}

/** For each kernel of a variant, the indices of the block's nodes it holds. */
function nodesOf(kernels: Kernel[]): number[][] {
  let next = 0;
  return kernels.map((k) => k.nodes.map(() => next++));
}

const VARIANTS = [
  {
    key: "unfused",
    title: "Fusion off",
    kernels: unfused,
    nodes: nodesOf(unfused),
    data: block.unfused,
  },
  { key: "fused", title: "Fused", kernels: fused, nodes: nodesOf(fused), data: block.fused },
] as const;

const largest = Math.max(
  ...[...unfused, ...fused].map((k) => k.args.reduce((s, a) => s + a.bytes, 0)),
);

export function FusionView() {
  const [active, setActive] = useState<number | null>(null);

  const where = (variant: (typeof VARIANTS)[number], node: number) => {
    const k = variant.nodes.findIndex((ns) => ns.includes(node));
    return `kernel ${k + 1} of ${variant.kernels.length}`;
  };

  return (
    <Figure
      title="Fusion on a ResNet-50 bottleneck block"
      subtitle="layer1.1 · 56×56 image · 256 → 64 → 64 → 256 channels · NHWC · float32"
      caption={
        <>
          Each card is one kernel, with the bytes of its arguments (what it reads and writes if it
          touches each once) drawn to one scale. Select an operator to find it in the other column.
          Computed with Tessera&apos;s own passes (<code>optimize</code>, <code>fuse</code>,{" "}
          <code>plan_memory</code>) on the block rebuilt with the model&apos;s shapes; see{" "}
          <code>data/SOURCE.md</code>. Over the whole model, fusion takes ResNet-50 from 123 kernels
          to 56 and from 322.3 to 205.7 MiB moved (results/models.md).
        </>
      }
    >
      <div className="fusion">
        {VARIANTS.map((variant) => {
          const other = variant.key === "fused" ? VARIANTS[0] : VARIANTS[1];
          return (
            <section key={variant.key} className="fusion-column" aria-label={variant.title}>
              <p className="fusion-head">
                <span className="fusion-title">{variant.title}</span>
                <span className="fusion-count">
                  {variant.kernels.length} kernels · {mib(variant.data.bytes_moved)} moved
                </span>
              </p>
              <ol className="fusion-kernels">
                {variant.kernels.map((k, ki) => {
                  const moved = k.args.reduce((s, a) => s + a.bytes, 0);
                  const out = k.args[k.args.length - 1] as Arg;
                  const nodes = variant.nodes[ki] ?? [];
                  const holds = active !== null && nodes.includes(active);
                  return (
                    <li
                      key={k.name}
                      className={holds ? "fusion-kernel is-active" : "fusion-kernel"}
                    >
                      <div className="fusion-ops">
                        {nodes.map((n, i) => (
                          <button
                            key={n}
                            type="button"
                            className={i === 0 && k.pattern !== "injective" ? "op op-anchor" : "op"}
                            aria-pressed={active === n}
                            aria-label={`${label(n)}: ${where(variant, n)} here, ${where(other, n)} in the other column`}
                            onClick={() => setActive((a) => (a === n ? null : n))}
                            onPointerEnter={() => setActive(n)}
                            onFocus={() => setActive(n)}
                          >
                            {label(n)}
                          </button>
                        ))}
                      </div>
                      <p className="fusion-writes">
                        writes {short(out.name)} {tensor(out)}
                        {out.kind === "ARENA" ? " to the arena" : " to the output"}
                      </p>
                      <div className="fusion-bytes">
                        <span className="fusion-track" aria-hidden="true">
                          <span
                            className="fusion-bar"
                            style={{ width: `${(moved / largest) * 100}%` }}
                          />
                        </span>
                        <span className="fusion-moved">{mib(moved)}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <p className="fusion-total">
                Arena {mib(variant.data.arena_bytes)} for the intermediates
              </p>
            </section>
          );
        })}
      </div>
      <p className="visually-hidden">
        Without fusion the block runs {unfused.length} kernels and moves{" "}
        {mib(block.unfused.bytes_moved)}; fused, it runs {fused.length} kernels and moves{" "}
        {mib(block.fused.bytes_moved)}. Each ReLU, and the residual Add, runs inside the convolution
        before it.
      </p>
    </Figure>
  );
}
