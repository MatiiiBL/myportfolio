import { Figure } from "../../components/Figure";
import { Section } from "../../components/Section";
import { Architecture } from "./Architecture";
import { FusionView } from "./FusionView";
import { FusionResults, KernelResults, LatencyResults, TuningResults } from "./Results";
import { ScheduleExplorer } from "./ScheduleExplorer";
import { SourceLink } from "./SourceLink";
import "../../components/ProjectPage.css";

// The tessera page body, inside ProjectLayout (docs/site.md, "Project pages").
export default function Page() {
  return (
    <div className="project-page">
      <Section id="overview" title="Overview">
        <div className="project-prose">
          <p>
            Tessera is a tensor compiler for Apple silicon that I wrote from scratch: about 28,000
            lines of Python and 1,600 of C and Objective-C. It imports an ONNX model, rewrites and
            fuses its graph, lowers each fused group to a loop IR modeled on TVM&apos;s TensorIR,
            and schedules those loops with templates whose knobs an autotuner sets with a learned
            cost model. The output is C with hand-written NEON and SME microkernels for the CPU, or
            Metal Shading Language for the GPU, built on a stock Mac without Xcode.
          </p>
          <p>
            The hard part is speed without wrong answers. Every schedule primitive rewrites the
            loops around a computation and must leave its result unchanged, or refuse. Every tuned
            configuration has to be faster inside the model, not only when timed alone. On an Apple
            M4 the GPU backend is the fastest system measured on all four benchmark models
            (ResNet-50, MobileNetV2, BERT-base and GPT-2), 1.13 to 1.56 times the best baseline, and
            every output agrees with ONNX Runtime to within 3e-6 of its largest magnitude.
          </p>
        </div>
      </Section>

      <Section
        id="schedule"
        title="Scheduling one kernel"
        kicker="Interactive"
        navLabel="Schedules"
      >
        <div className="project-prose">
          <p>
            This is the kernel Tessera&apos;s documentation uses to show its generated C: a matrix
            product with a bias and a ReLU, fused into one group. The controls are the five knobs of
            the CPU matmul template on the portable C target. Changing one runs the template again.
            It splits the row and column loops into register tiles, moves the reduction inside them,
            accumulates each tile in a local buffer, inlines the ReLU into the tile&apos;s
            write-back and, in <code>nm</code> order, copies each strip of W into a contiguous
            buffer before the row tiles that use it.
          </p>
        </div>
        <ScheduleExplorer />
        <div className="project-prose">
          <p>
            On the M4&apos;s SME target the same template stops at the tiles and hands each one to a
            microkernel through <code>tensorize</code>, which first checks that the loop nest
            computes exactly what the microkernel&apos;s description says. Fusion decides how many
            such kernels a model needs. In a ResNet-50 bottleneck, each ReLU and the residual Add
            run inside the convolution before them, so their inputs never go through memory.
          </p>
        </div>
        <FusionView />
      </Section>

      <Section id="results" title="Results">
        <div className="project-prose">
          <p>
            Batch-1 float32 latency on an Apple M4 (4 performance cores, 10-core GPU), against ONNX
            Runtime and PyTorch on the CPU and PyTorch on the GPU through MPS, each in its fastest
            configuration.
          </p>
        </div>
        <LatencyResults />
        <div className="project-prose">
          <p>
            On the CPU, Tessera is faster than ONNX Runtime on ResNet-50, MobileNetV2 and BERT and
            slower on GPT-2 (0.93 times), whose 50,257-wide vocabulary projection runs at 0.66 times
            the speed of Apple&apos;s Accelerate library.
          </p>
          <h3 className="project-subhead">Autotuning</h3>
          <p>
            Every distinct fused group is a tuning task: 78 per target over the four models, with
            3.1 million configurations in all on the CPU and 420 million on the GPU. An evolutionary
            search proposes candidates and a gradient-boosted cost model, written in NumPy and
            trained on features of the scheduled loop nests, ranks them. The 25,651 measurements are
            committed as logs. On a synthetic task with a known optimum, model-guided search finds
            better schedules than random search for the same number of measurements; on real tasks,
            where measurements are noisy, the difference is smaller.
          </p>
        </div>
        <TuningResults />
        <div className="project-prose">
          <p>
            Tuning gains up to 1.58 times per model (ResNet-50 on the GPU). On GPT-2 on the CPU it
            changes nothing beyond noise: 32.36 ms with the defaults, 32.68 ms tuned.
          </p>
          <h3 className="project-subhead">Fusion and kernels</h3>
          <p>
            Fusion leaves 37 to 53% as many kernels and moves 23 to 43% fewer bytes. On the GPU it
            makes every model faster (1.02 to 1.19 times); on the CPU the difference is within the
            noise. One arena holds every intermediate tensor in 3.9 to 31 times less memory than
            separate buffers. On the shapes of the transformer layers, the SME GEMM is 1.16 to 1.47
            times Accelerate&apos;s speed; at 2048³ the Metal GEMM is within 3% of MPS.
          </p>
        </div>
        <div className="project-grid">
          <FusionResults />
          <KernelResults />
        </div>
      </Section>

      <Section id="how" title="How it works">
        <div className="project-how">
          <Figure
            title="From an ONNX model to native code"
            subtitle="one kernel per fused group"
            caption={
              <>
                A template schedules each group&apos;s loop IR with the configuration the tuning
                logs hold for its task, or with its defaults, and a backend prints the result.
                Source: <SourceLink file="docs/design.md" />.
              </>
            }
          >
            <Architecture />
          </Figure>
          <div className="project-decisions">
            <article>
              <h3>Schedules that can be checked</h3>
              <p>
                The loop IR separates what a block computes from the loops around it. A block
                declares its iteration domains and the regions it reads and writes, and schedule
                primitives (split, reorder, fuse, <code>compute_at</code>, <code>cache_read</code>,{" "}
                <code>tensorize</code> and the rest) rewrite only loops and bindings. Each
                primitive&apos;s legality check is therefore local, and it refuses with an error
                rather than miscompile. A Python interpreter runs any scheduled function, so every
                schedule can be compared with the unscheduled one: a randomized test applies up to
                ten random primitives to random computations, 300 times per run, and checks the
                result each time.
              </p>
            </article>
            <article>
              <h3>Microkernels by tensorization</h3>
              <p>
                The inner loops that matter are written by hand once per instruction set: an 8×12
                register tile for NEON, and for SME a 32×32 block of the output held in the ZA
                array, with four <code>fmopa</code> outer products per step of the reduction and one
                entry into streaming mode per macro block. <code>tensorize</code> matches a loop
                nest against a microkernel&apos;s description, edge tiles included, so templates
                only decide tiling, order and parallelism. Without schedules the generated C is 28
                to 417 times slower; without SME, 2.2 to 2.9 times slower on three of the four
                models.
              </p>
            </article>
            <article>
              <h3>Time what the model runs</h3>
              <p>
                The first tuning run made GPT-2 slower on the CPU, because kernels timed alone
                disagreed with the same kernels inside the model. The main cause was thread
                placement: macOS moved busy SME worker threads to the efficiency cores, and a
                spinning worker stayed there. Idle workers now sleep, iterations are claimed
                dynamically, and a worker woken on an efficiency core leaves the loop to the others.
                Kernels are timed with cold, pre-packed weights, as a model run reads them, and
                tuned configurations are validated inside the models before they are used; that pass
                found about a quarter of them slower in the model than the defaults.
              </p>
            </article>
          </div>
        </div>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="project-limits">
          <li>
            <strong>Batch 1, float32, static shapes.</strong> There are no int8 or float16 kernels,
            and dynamic dimensions are fixed at compile time.
          </li>
          <li>
            <strong>CPU convolutions trail PyTorch&apos;s.</strong> Measured kernel by kernel,
            Tessera beats PyTorch on the CPU on 4 of ResNet-50&apos;s 23 convolution shapes,
            although the whole model is faster (11.52 against 13.18 ms). Large square GEMMs and
            GPT-2&apos;s vocabulary projection are slower than Accelerate (0.71 and 0.66 times).
          </li>
          <li>
            <strong>Thread placement on the CPU.</strong> macOS sometimes keeps one SME worker on an
            efficiency core for a whole process, which then runs on three threads: ResNet-50 takes
            about 15.5 ms instead of 12. No user-space fix is known.
          </li>
          <li>
            <strong>Strided convolutions on Metal.</strong> Six of ResNet-50&apos;s seven are slow:
            212 to 322 GFLOP/s, against a median of 1,374 over all its convolution shapes.
          </li>
          <li>
            <strong>Tuning covers a small part of each search space,</strong> and the logs are
            specific to the M4 they were made on.
          </li>
        </ul>
        <p className="project-source">
          Source: <SourceLink file="README.md" anchor="limitations" />; the method and the full
          tables are in <SourceLink file="docs/evaluation.md" />.
        </p>
      </Section>
    </div>
  );
}
