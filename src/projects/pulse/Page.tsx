import { BarChart } from "../../components/charts";
import { Figure } from "../../components/Figure";
import { Section } from "../../components/Section";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import results from "./data/results.json";
import { FmaxChart } from "./FmaxChart";
import { SystolicStepper } from "./SystolicStepper";
import "./Page.css";

const REPO = "https://github.com/MatiiiBL/riscv-npu-soc";
const COMMIT = "5bc8ccf";

function SourceLink({ file, anchor }: { file: string; anchor?: string }) {
  return (
    <a className="pulse-file" href={`${REPO}/blob/${COMMIT}/${file}${anchor ? `#${anchor}` : ""}`}>
      {file}
    </a>
  );
}

// The Pulse page body, inside ProjectLayout (docs/site.md, "Project pages").
export default function Page() {
  const { coremark, fpga } = results;
  const mnist = results.speedups[0];
  return (
    <div className="pulse">
      <Section id="overview" title="Overview">
        <div className="pulse-prose">
          <p>
            Pulse is a small system-on-chip I wrote in SystemVerilog. A 5-stage pipelined RISC-V CPU
            (RV32IM: the base integer instructions plus multiply and divide) drives a neural
            processing unit (NPU): an 8 × 8 systolic array of INT8 multiply-accumulate cells with
            its own DMA engine. Bare-metal C firmware, built with clang, programs the NPU through
            memory-mapped registers. Quantized MNIST runs 115 times faster on the NPU than on the
            CPU alone, with bit-identical results, and the design meets timing at 40 MHz on a
            Lattice ECP5 FPGA with a fully open-source flow.
          </p>
          <p>
            The array is the easy part. The hard parts are keeping it fed and proving the chip
            right. Eight rows and eight columns of operands must arrive every cycle, so the memory
            system, not the multipliers, sets the throughput. And the RTL is checked against a C++
            reference simulator written separately from the same spec, compared at every retired
            instruction on thousands of random programs, while the NPU is tested bit for bit against
            a Python model in six array and port configurations.
          </p>
        </div>
      </Section>

      <Section id="array" title="The array, cycle by cycle" kicker="Interactive" navLabel="Array">
        <div className="pulse-prose">
          <p>
            One NPU command at the timing of the RTL. The CPU writes the registers and{" "}
            <code>START</code>; the DMA loads each row of A and B into the operand buffers, one
            16-byte block per cycle; then the operands enter the array skewed. Row <i>i</i> of A
            enters from the west and row <i>j</i> of B from the north, each one cycle behind its
            neighbor, so <code>A[i][k]</code> and <code>B[j][k]</code> meet in PE (<i>i</i>,{" "}
            <i>j</i>) at step <i>k</i> + <i>i</i> + <i>j</i> + 3. Every processing element (PE)
            multiplies its pair, adds the previous product to its own INT32 sum and passes both
            operands on. The sums never move (the array is output-stationary); write-back drains
            them to memory, one per cycle. The skew costs no delay registers: each row&apos;s feeder
            reads its operand buffer one step later than the row above.
          </p>
        </div>
        <Figure
          title="One NPU command on the 8 × 8 array"
          subtitle="C = A × Bᵀ · INT8 operands · INT32 sums · 16-byte DMA port"
          caption={
            <>
              Hover or tap a PE to see what it does in the current step; the slider and its arrow
              keys move one cycle at a time. The counter is the NPU&apos;s <code>CYCLES</code>{" "}
              register. Operands are drawn from −7 to 7 so the sums fit in a cell; the hardware
              takes the full INT8 range. The picture runs a cycle-level model written from{" "}
              <SourceLink file="rtl/npu/npu_opbuf.sv" />, <SourceLink file="rtl/npu/npu_pe.sv" />{" "}
              and <SourceLink file="rtl/npu/npu_top.sv" />; its tests check it against a plain
              matrix product and against every cycle count measured on the RTL in{" "}
              <SourceLink file="docs/npu.md" anchor="6-performance" />.
            </>
          }
        >
          <SystolicStepper />
        </Figure>
      </Section>

      <Section id="results" title="Results">
        <div className="pulse-prose">
          <p>
            Measured on the RTL with Verilator, which counts cycles exactly; times assume the 40 MHz
            clock the FPGA build meets. The CPU baselines are the same kernels in plain C, compiled
            with clang <code>-O2</code> and checked for equal output.
          </p>
        </div>

        <BarChart
          title="Speedup of the NPU over the CPU alone"
          subtitle="cycles on the CPU ÷ cycles on CPU + NPU · driver and polling included"
          categories={results.speedups.map((s) => s.short)}
          categoryLabel="Workload"
          series={[
            { id: "speedup", label: "Speedup", values: results.speedups.map((s) => s.speedup) },
          ]}
          value={{ type: "linear", label: "speedup", format: (v) => `${v}×` }}
          caption={
            <>
              MNIST is a 784-128-10 multilayer perceptron, batch 8:{" "}
              {mnist?.cpu.toLocaleString("en-US")} cycles per image on the CPU (8.8 ms) against{" "}
              {mnist?.npu.toLocaleString("en-US")} (76 µs). Small GEMMs are dominated by the driver,
              large ones by moving operands. Source:{" "}
              <SourceLink file="README.md" anchor="results" />.
            </>
          }
        />

        <BarChart
          title="One 8 × 8 × 1024 tile, as the operand path improved"
          subtitle="multiply-accumulates per cycle · peak 64"
          categories={results.tileSteps.map((s) => s.config)}
          categoryLabel="NPU configuration"
          series={[
            {
              id: "macs",
              label: "MACs per cycle",
              values: results.tileSteps.map((s) => s.macsPerCycle),
            },
          ]}
          value={{ type: "linear", domain: [0, 64], label: "MACs per cycle" }}
          references={[{ value: 64, label: "peak" }]}
          caption={
            <>
              A wider DMA port (16 bytes per cycle from four banks) and operand reuse took one tile
              from {results.tileSteps[0]?.cycles.toLocaleString("en-US")} cycles to{" "}
              {results.tileSteps.at(-1)?.cycles.toLocaleString("en-US")}. Source:{" "}
              <SourceLink file="README.md" anchor="npu-vs-cpu" />.
            </>
          }
        />

        <FmaxChart
          steps={results.timingClosure}
          targetMHz={fpga.clockMHz}
          caption={
            <>
              Every critical path of the first version started at a block RAM output; each step
              removed one. The final pipeline reaches {fpga.fmaxRange} at a 40 MHz constraint.
              Source:{" "}
              <SourceLink
                file="README.md"
                anchor="fpga-radiona-ulx3s-lattice-lfe5u-85f-speed-grade-6"
              />
              .
            </>
          }
        />

        <div className="pulse-grid">
          <div className="pulse-table-wrap">
            <table className="pulse-table">
              <caption>CoreMark, 10 iterations</caption>
              <thead>
                <tr>
                  <td />
                  <th scope="col">Branch prediction</th>
                  <th scope="col">Static not-taken</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">CoreMark / MHz</th>
                  <td>{coremark.predictorOn.perMHz}</td>
                  <td>{coremark.predictorOff.perMHz}</td>
                </tr>
                <tr>
                  <th scope="row">CPI</th>
                  <td>{coremark.predictorOn.cpi}</td>
                  <td>{coremark.predictorOff.cpi}</td>
                </tr>
                <tr>
                  <th scope="row">CoreMark / s at 40 MHz</th>
                  <td>{coremark.predictorOn.perSecond}</td>
                  <td>{coremark.predictorOff.perSecond}</td>
                </tr>
              </tbody>
            </table>
            <p className="pulse-source">
              A 64-entry BTB with 2-bit counters mispredicts {coremark.mispredictRate}% of
              CoreMark&apos;s branches. Source: <SourceLink file="README.md" anchor="cpu" />.
            </p>
          </div>
          <div className="pulse-table-wrap">
            <table className="pulse-table">
              <caption>FPGA: {fpga.board}</caption>
              <thead>
                <tr>
                  <td />
                  <th scope="col">Used</th>
                  <th scope="col">Share</th>
                </tr>
              </thead>
              <tbody>
                {fpga.resources.map((r) => (
                  <tr key={r.resource}>
                    <th scope="row">{r.resource}</th>
                    <td>{r.used}</td>
                    <td>{r.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="pulse-source">
              At {fpga.clockMHz} MHz from the on-chip PLL. Source:{" "}
              <SourceLink file="docs/fpga.md" anchor="6-results" />.
            </p>
          </div>
        </div>
      </Section>

      <Section id="how" title="How it works">
        <div className="pulse-how">
          <Figure
            title="The system-on-chip"
            subtitle="Harvard memories · one clock · every slave answers in one cycle"
            caption={
              <>
                The CPU reaches data memory, the UART and the NPU&apos;s registers through an
                address decoder; the NPU&apos;s DMA owns the second port of the data memory. Source:{" "}
                <SourceLink file="docs/spec.md" />.
              </>
            }
          >
            <ArchitectureDiagram />
          </Figure>
          <div className="pulse-decisions">
            <article>
              <h3>Two implementations of one spec</h3>
              <p>
                The RTL and a C++ instruction-set simulator are written separately against one spec,
                which fixes the memory map, the bus timing and the NPU&apos;s exact arithmetic.
                Random programs run on both, and their commit logs (PC, instruction, register write,
                memory access) must match line for line, so a bug has to be made twice, in two
                languages, to go unnoticed. The tests were tested too: of 23 bugs injected into the
                NPU RTL, the suite caught 22, and the survivor writes a word that is always
                overwritten.
              </p>
            </article>
            <article>
              <h3>A memory port for the NPU</h3>
              <p>
                The data memory is four word-interleaved, true dual-port banks. The CPU uses one
                32-bit port; the NPU&apos;s DMA reads or writes a 16-byte block per cycle on the
                other, so it never stalls the CPU, and banking costs no extra block RAM. That made
                MNIST on the NPU 1.9 times faster. A full tile still needs 16 new operand bytes per
                step, so the NPU also keeps what it loaded: <code>A_KEEP</code> and{" "}
                <code>B_KEEP</code> skip reloading an operand, and because the NPU tags each buffer
                with its address, stride, rows and K, a wrong hint costs time, never correctness.
              </p>
            </article>
            <article>
              <h3>Clock over CPI</h3>
              <p>
                Forwarding load data from block RAM put the RAM&apos;s clock-to-out, bank steering,
                alignment and an adder in one cycle. Loads now reach their consumers through the
                register file instead, one or two bubbles later. That costs 15% CPI on CoreMark and
                buys a 1.6 times faster clock: a net 1.39 times faster on CoreMark and 1.59 times on
                MNIST.
              </p>
            </article>
          </div>
        </div>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="pulse-limits">
          <li>
            <strong>Not yet run on a physical board.</strong> The bitstream builds and meets timing
            at 40 MHz, and its firmware runs in simulation with the board&apos;s real UART logic.
          </li>
          <li>
            <strong>A simple memory system.</strong> No caches and no external memory: a program and
            its data must fit in 64 KiB + 256 KiB. The MNIST demo runs 100 test images in hardware
            and reports accuracy over all 10,000 from the bit-exact Python model (98.07%).
          </li>
          <li>
            <strong>The NPU runs one phase at a time.</strong> Loading, computing and writing back
            happen in sequence. Double-buffering the operand banks, half used at the maximum K of
            1024, would overlap the next load with the current compute.
          </li>
          <li>
            <strong>Past 40 MHz</strong> needs a decoupled fetch queue (the critical path runs from
            the instruction memory through decode to the stall) and a two-stage multiplier.
          </li>
          <li>
            <strong>CoreMark runs 10 iterations</strong> to keep simulation short, so the score is
            not a valid submission under CoreMark&apos;s run rules.
          </li>
        </ul>
        <p className="pulse-source">
          Source: <SourceLink file="README.md" anchor="limitations-and-next-steps" />.
        </p>
      </Section>
    </div>
  );
}
