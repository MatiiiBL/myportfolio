import { Figure } from "../../components/Figure";
import { Section } from "../../components/Section";
import { BarChart } from "../../components/charts";
import "../../components/ProjectPage.css";
import { DecodeStep } from "./DecodeStep";
import { ForwardPassDiagram } from "./ForwardPassDiagram";
import { Q8Explorer } from "./Q8Explorer";
import { SMOLLM2, kvBytesPerToken } from "./model";
import results from "./data/results.json";

// The minillm page body, inside ProjectLayout (docs/site.md, "Project pages"). Every number is
// from the repository at the commit in data/SOURCE.md.
const REPO = "https://github.com/MatiiiBL/LLM-inference-engine";
const COMMIT = "bb175958c4718f47f9609d5fa4c933b3a26eb255";
const MIB = 1024 * 1024;

/** A link to a file of the repository at the page's commit. */
function SourceLink({ file, anchor }: { file: string; anchor?: string }) {
  return (
    <a
      className="project-file"
      href={`${REPO}/blob/${COMMIT}/${file}${anchor ? `#${anchor}` : ""}`}
    >
      {file}
    </a>
  );
}

export default function Page() {
  const fullContext = (SMOLLM2.maxPositions * kvBytesPerToken(SMOLLM2)) / MIB;
  return (
    <div className="project-page">
      <Section id="overview" title="Overview">
        <div className="project-prose">
          <p>
            I wrote minillm: an inference engine for Llama-architecture language models in C++20,
            with no dependencies beyond a test framework and a JSON parser. It loads SmolLM2-135M
            (30 layers, 576 wide, 9 query heads sharing 3 key-value heads) from its safetensors
            checkpoint, tokenizes the prompt, runs the forward pass over a preallocated KV cache and
            samples the continuation. Its 64-token greedy generations match PyTorch&apos;s token for
            token.
          </p>
          <p>
            An inference engine can be wrong and still write fluent text: pair the RoPE dimensions
            the wrong way, or assume the usual RoPE base instead of SmolLM2&apos;s 100,000, and the
            model just gets a little worse. So correctness comes first. Every kernel exists twice: a
            naive scalar reference checked against PyTorch, and an optimized version (NEON, threads,
            an online softmax) checked against the reference. Weights can be held as f32, bf16 or
            Q8_0, an 8-bit format with one f16 scale per 32 weights. Q8_0 takes 143 MB: 3.8× smaller
            than f32 (538 MB), and 1.9× smaller than the bf16 checkpoint (269 MB) that the engine
            loads by default.
          </p>
        </div>
      </Section>

      <Section id="decode" title="One decoding step" kicker="Interactive" navLabel="Decoding">
        <Figure
          title="The KV cache and the attention of one token"
          subtitle="SmolLM2-135M · layers 0 and 15 · 9 query heads, 3 KV heads, head_dim 64"
          caption={
            <>
              Real values: PyTorch&apos;s queries and keys for layers 0 and 15 of a 13-token prompt,
              from minillm&apos;s attention oracle, turned into weights with a softmax over the
              cached positions. Row t of a causal forward pass is exactly what a decode step at
              position t computes, so stepping through the prompt shows the cache growing as it does
              during generation: the token&apos;s keys and values become a new column in every
              layer, and each of its 9 query heads attends over positions 0 to t. Heads 0–2, 3–5 and
              6–8 each read one shared KV head. In layer 15 every head puts 42% to 90% of its weight
              on the first token, averaged over positions 1 to 12; layer 0 spreads it out. minillm
              checks that a prefill followed by one decode step gives the same logits as a single
              prefill of the same tokens, within 5.5e-5. Source:{" "}
              <SourceLink file="oracle/generate.py" />.
            </>
          }
        >
          <DecodeStep />
        </Figure>
      </Section>

      <Section id="q8" title="Q8_0, one block at a time" kicker="Interactive" navLabel="Q8_0">
        <Figure
          title="A block of 32 real weights, quantized"
          subtitle="SmolLM2-135M checkpoint · d = f16(max |x| / 127) · q = round(x / d)"
          caption={
            <>
              Eight blocks of real weights from the checkpoint, quantized by a port of
              minillm&apos;s quantizer; a unit test checks that it writes the same bytes as the
              repository&apos;s reference implementation for every one of them. The top plot is the
              weights, the bottom one the error each keeps after rounding. Pick a weight and drag
              its slider to make it an outlier: the scale grows with it, and so does every other
              weight&apos;s error. Source: <SourceLink file="src/loader/quantize.cpp" />.
            </>
          }
        >
          <Q8Explorer />
        </Figure>
      </Section>

      <Section id="results" title="Results">
        <div className="project-prose">
          <p>
            The 64-token greedy generations for each of the oracle&apos;s three prompts match
            PyTorch&apos;s id for id, with f32 and with bf16 weights; with Q8_0 weights they match
            PyTorch running on the same rounded weights. Every hidden state and the final logits are
            compared with PyTorch&apos;s, layer by layer.
          </p>
        </div>

        <div className="project-grid">
          <BarChart
            title="Weight memory by format"
            subtitle="SmolLM2-135M · projections and embedding · norms stay f32"
            categories={results.weights.map((w) => w.format)}
            series={[{ id: "mb", label: "MB", values: results.weights.map((w) => w.mb) }]}
            value={{ type: "linear", label: "MB", format: (v) => `${v.toFixed(1)} MB` }}
            categoryLabel="Format"
            emphasis={["Q8_0"]}
            caption={
              <>
                The arithmetic is f32 in every format. The default picks bf16 for this checkpoint
                because it is stored in bf16, so the conversion is exact. Source:{" "}
                <SourceLink file="README.md" anchor="running" />.
              </>
            }
          />
          <BarChart
            title="What Q8_0 costs in quality"
            subtitle="mean KL(f32 engine ‖ Q8_0 engine) · teacher-forced"
            categories={results.kl.map((k) => `${k.set} (${k.positions.toLocaleString("en-US")})`)}
            series={[
              {
                id: "measured",
                label: "Measured",
                values: results.kl.map((k) => k.measured * 1e3),
              },
              {
                id: "budget",
                label: "Budget",
                values: results.kl.map((k) => k.budget * 1e3),
                color: "muted",
              },
            ]}
            value={{
              type: "linear",
              label: "10⁻³ nats per position",
              format: (v) => v.toFixed(2),
            }}
            categoryLabel="Evaluation set (positions)"
            caption={
              <>
                A test enforces the budget; the measured KL moves only when the format or the
                quantizer changes. A quantizer that truncates instead of rounding is 2.8 to 3.4
                times over it on every set. Source: <SourceLink file="tests/common/tolerances.h" />.
              </>
            }
          />
        </div>

        <h3>Measured error against PyTorch</h3>
        <div className="project-prose">
          <p>
            Floating-point addition is not associative, so a kernel that sums in a different order
            differs from PyTorch in the last bits. Each tolerance is set from a measurement taken
            with every tolerance at zero, and all of them live in one file.
          </p>
        </div>
        <div
          className="project-table-wrap"
          role="region"
          aria-label="Measured error against PyTorch"
          tabIndex={0}
        >
          <table className="project-table">
            <caption>Largest absolute error of each stage, and the bound its test enforces</caption>
            <thead>
              <tr>
                <th scope="col">Stage</th>
                <th scope="col" className="project-text">
                  Inputs
                </th>
                <th scope="col">Max abs error</th>
                <th scope="col">Bound</th>
              </tr>
            </thead>
            <tbody>
              {results.errors.map((e) => (
                <tr key={e.stage}>
                  <th scope="row">{e.stage}</th>
                  <td className="project-text">{e.shape}</td>
                  <td>
                    <strong>{e.maxAbs}</strong>
                  </td>
                  <td>{e.tolerance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="project-source">
          The hidden-state error comes from the first token&apos;s row, where SmolLM2 parks
          attention-sink activations of up to about 2e4 and one float32 ulp is about 1e-3; the worst
          element of each prompt uses 12% to 34% of its bound. Token ids are compared exactly: one
          divergent token fails the test, whatever the logits say. Source:{" "}
          <SourceLink file="tests/common/tolerances.h" />.
        </p>
      </Section>

      <Section id="how-it-works" title="How it works">
        <div className="project-how">
          <Figure
            title="One forward pass"
            subtitle="prefill: n prompt tokens · decode: n = 1"
            caption={
              <>
                Prefill and decode are the same code path; only the number of rows differs. Source:{" "}
                <SourceLink file="src/model/model.cpp" />.
              </>
            }
          >
            <ForwardPassDiagram />
          </Figure>
          <div className="project-decisions">
            <article>
              <h3>Two implementations of every op</h3>
              <p>
                <code>src/ops_ref/</code> holds naive scalar loops: no SIMD, no threads, no
                fast-math. They are checked against PyTorch&apos;s intermediate values and never
                optimized, because every tolerance in the repository is measured against them. The
                engine calls <code>src/ops/</code>, and each kernel there is checked against the
                reference on random inputs and against PyTorch on real ones. The interfaces between
                the ten modules are nine frozen headers, so the slow and the fast version of an op
                have the same signature and share one test.
              </p>
            </article>
            <article>
              <h3>The cache is the attention kernel&apos;s input</h3>
              <p>
                The KV cache is allocated once, as [layer][position][kv_head][head_dim] floats, and
                never resized. The K and V projections write straight into their position and RoPE
                rotates the keys in place, so a layer&apos;s cached prefix is one contiguous [len,
                3, 64] block that attention reads without a copy. Causality is a loop bound; there
                is no mask. Attention runs an online softmax over blocks of 128 keys (the
                flash-attention recurrence) and handles the three query heads of a group together,
                so every K and V vector it loads serves three heads.
              </p>
            </article>
            <article>
              <h3>Q8_0 without giving up exactness</h3>
              <p>
                A Q8_0 weight stands for exactly the f32 matrix q × d, so the references apply
                unchanged. To decode one token, the kernel widens a block&apos;s 32 int8 values to
                float, takes their dot product with the input unscaled, and folds the scale in with
                one fused multiply-add: d · Σ x·q. For a long prompt, converting per row would cost
                more with every row, so a panel of weight rows is dequantized once into scratch
                memory and a register tile runs every input row against it. Both kernels compute
                each output the same way however the work is split, so results are bitwise identical
                at every thread count.
              </p>
            </article>
          </div>
        </div>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="project-limits">
          <li>
            <strong>One sequence at a time.</strong> There is no batching.
          </li>
          <li>
            <strong>f32 compute throughout.</strong> bf16 and Q8_0 change how weights are stored,
            not the arithmetic, and the KV cache stays f32:{" "}
            {Math.round(kvBytesPerToken(SMOLLM2) / 1024)} KiB per token, {Math.round(fullContext)}{" "}
            MiB for SmolLM2&apos;s full {SMOLLM2.maxPositions.toLocaleString("en-US")}-token
            context.
          </li>
          <li>
            <strong>Llama-family checkpoints only.</strong> The config loader rejects RoPE scaling,
            attention or MLP biases and activations other than SiLU instead of computing something
            else.
          </li>
          <li>
            <strong>Q8_0 is slow on x86.</strong> There the kernels run a portable path meant for
            correctness: in CI&apos;s x86-64 build, Q8_0 decode runs at about half the speed of f32,
            because SSE2 has no cheap int8-to-float conversion.
          </li>
          <li>
            <strong>No committed speed results.</strong> The benchmark runs in CI on every push, but
            its results are not in the repository, so this page quotes none.
          </li>
        </ul>
        <p className="project-source">
          The README has no limitations section; these are from the engine&apos;s own headers and
          kernel notes. Source: <SourceLink file="include/minillm/model.h" />,{" "}
          <SourceLink file="include/minillm/config.h" />, <SourceLink file="src/ops/q8_0.cpp" />.
        </p>
      </Section>
    </div>
  );
}
