import { Section } from "../../components/Section";
import results from "./data/results.json";
import { SystolicStepper } from "./SystolicStepper";
import "./Page.css";

const REPO = "https://github.com/MatiiiBL/riscv-npu-soc";
const SOURCE_COMMIT = "5bc8ccf";

function Source({ file, children }: { file: string; children?: string }) {
  return (
    <p className="pulse-source">
      Source: <a href={`${REPO}/blob/${SOURCE_COMMIT}/${file}`}>{file}</a>
      {children ? `, ${children}` : ""}.
    </p>
  );
}

// The Pulse page body, inside ProjectLayout (docs/site.md, "Project pages").
export default function Page() {
  const { coremark, fpga } = results;
  return (
    <div className="pulse">
      <Section id="overview" title="Overview">
        <div className="pulse-prose">
          <p>
            Pulse is a small system-on-chip I wrote in SystemVerilog. A 5-stage pipelined RISC-V CPU
            (RV32IM: the base integer ISA plus multiply and divide) drives a neural processing unit
            (NPU): an 8 × 8 systolic array of INT8 multiply-accumulate cells with its own DMA
            engine. Bare-metal C firmware, built with clang, programs the NPU through memory-mapped
            registers. Quantized MNIST runs 115 times faster on the NPU than on the CPU alone, with
            bit-identical results, and the design meets timing at 40 MHz on a Lattice ECP5 FPGA with
            a fully open-source flow.
          </p>
          <p>
            The array is the easy part. The hard parts are keeping it fed and proving the whole chip
            right. Eight rows and eight columns of operands must arrive every cycle, so the memory
            system, not the multipliers, sets the throughput. And the RTL is checked against a C++
            reference simulator written separately from the same spec, compared at every retired
            instruction on thousands of random programs, while the NPU is tested bit for bit against
            a Python model in six array and port configurations.
          </p>
        </div>
      </Section>

      <Section id="array" title="The array, cycle by cycle" kicker="Interactive">
        <div className="pulse-prose">
          <p>
            One NPU command, at the timing of the RTL. The CPU writes the registers and{" "}
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
        <SystolicStepper />
        <p className="pulse-caption">
          Hover or tap a PE to see what it does in the current step; the slider and the arrow keys
          move one cycle at a time. The counter is the NPU&apos;s <code>CYCLES</code> register.
          Operands are drawn from −7 to 7 so the sums fit in a cell; the hardware takes the full
          INT8 range. The model behind this picture is checked against a plain matrix product and
          reproduces every cycle count the repository measured on the RTL.
        </p>
      </Section>

      <Section id="results" title="Results">
        <div className="pulse-prose">
          <p>
            Measured on the RTL with Verilator, which counts cycles exactly; times assume the 40 MHz
            clock the FPGA build meets. The CPU baselines are the same kernels in plain C, compiled
            with clang <code>-O2</code> and checked for equal output.
          </p>
        </div>

        <div className="pulse-table-wrap">
          <table className="pulse-table">
            <caption>NPU against the CPU alone, cycles per workload</caption>
            <thead>
              <tr>
                <th scope="col">Workload</th>
                <th scope="col">CPU only</th>
                <th scope="col">CPU + NPU</th>
                <th scope="col">Speedup</th>
              </tr>
            </thead>
            <tbody>
              {results.speedups.map((row) => (
                <tr key={row.workload}>
                  <th scope="row">{row.workload}</th>
                  <td>{row.cpu.toLocaleString("en-US")}</td>
                  <td>{row.npu.toLocaleString("en-US")}</td>
                  <td>{row.speedup}×</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Source file="README.md">Results, NPU vs. CPU</Source>

        <div className="pulse-table-wrap">
          <table className="pulse-table">
            <caption>One 8 × 8 × 1024 tile, as the operand path got wider and smarter</caption>
            <thead>
              <tr>
                <th scope="col">NPU configuration</th>
                <th scope="col">Cycles</th>
                <th scope="col">MACs per cycle (of 64)</th>
              </tr>
            </thead>
            <tbody>
              {results.tileSteps.map((row) => (
                <tr key={row.config}>
                  <th scope="row">{row.config}</th>
                  <td>{row.cycles.toLocaleString("en-US")}</td>
                  <td>{row.macsPerCycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Source file="README.md">Results, NPU vs. CPU</Source>

        <div className="pulse-grid">
          <div className="pulse-table-wrap">
            <table className="pulse-table">
              <caption>CoreMark, 10 iterations</caption>
              <thead>
                <tr>
                  <th scope="col" />
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
            <Source file="README.md">Results, CPU</Source>
          </div>
          <div className="pulse-table-wrap">
            <table className="pulse-table">
              <caption>FPGA: {fpga.board}</caption>
              <tbody>
                <tr>
                  <th scope="row">Clock</th>
                  <td colSpan={2}>
                    {fpga.clockMHz} MHz ({fpga.fmaxRange})
                  </td>
                </tr>
                {fpga.resources.map((r) => (
                  <tr key={r.resource}>
                    <th scope="row">{r.resource}</th>
                    <td>{r.used}</td>
                    <td>{r.share}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Source file="docs/fpga.md">section 6</Source>
          </div>
        </div>
      </Section>

      <Section id="how" title="How it works">
        <div className="pulse-prose">
          <p>
            The memories are Harvard: 64 KiB of instruction memory and 256 KiB of data memory, all
            block RAM with one cycle of latency. The CPU reaches the data memory, the UART and the
            NPU&apos;s registers through an address decoder; the NPU has a port of its own.
          </p>
        </div>
        <div className="pulse-decisions">
          <article>
            <h3>Two implementations of one spec</h3>
            <p>
              The RTL and a C++ instruction-set simulator are written separately against{" "}
              <a href={`${REPO}/blob/${SOURCE_COMMIT}/docs/spec.md`}>docs/spec.md</a>, which defines
              the memory map, the bus timing and the NPU&apos;s exact semantics. Random programs run
              on both, and their commit logs (PC, instruction, register write, memory access) must
              match line for line, so a bug has to be made twice, in two languages, to go unnoticed.
              The tests were tested too: of 23 bugs injected into the NPU RTL, the suite caught 22,
              and the survivor writes a word that is always overwritten.
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
              <code>B_KEEP</code> skip reloading an operand, and since the NPU tags each buffer with
              its address, stride, rows and K, a wrong hint costs time, never correctness.
            </p>
          </article>
          <article>
            <h3>Clock over CPI</h3>
            <p>
              The first version closed timing at 25 MHz: every critical path started at a block RAM
              output. Forwarding load data put the RAM&apos;s clock-to-out, bank steering, alignment
              and an adder in one cycle, so loads now reach their consumers through the register
              file instead. That costs 15% CPI on CoreMark and buys a 1.6 times faster clock: a net
              1.39 times faster on CoreMark and 1.59 times on MNIST.
            </p>
          </article>
        </div>
        <Source file="README.md">Design decisions; docs/core.md, section 10</Source>
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
        <Source file="README.md">Limitations and next steps</Source>
      </Section>
    </div>
  );
}
