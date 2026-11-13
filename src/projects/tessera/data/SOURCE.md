# Sources of the Tessera data

Repository: https://github.com/MatiiiBL/tessera, commit `9eda498`
(`9eda498cf4fc692ef399883a69a572148b3ada82`). The measurements in the result files were taken
on an Apple M4 on 2026-11-12 at the commits each file records (`e047e7f` for models and
kernels, `099844c` for tuning).

| File                    | From                                        | What was kept                                                                                                                                                                                                                                                                    |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `models.json`           | `results/models.json`                       | Per model and system: median, p10 and p90 latency (seconds converted to milliseconds, rounded to 0.001 ms) and the largest relative error against ONNX Runtime. Per model and target, the `full` and `fusion off` ablations: kernels, bytes moved, arena and intermediate bytes. |
| `tuning.json`           | `results/tuning.json`                       | For every task and strategy, the best throughput found after each measurement relative to the task's reference (`reference_seconds / best_seconds`), averaged over the seeds, rounded to 4 decimals.                                                                             |
| `gemm.json`             | `results/ops.json`                          | GEMM throughput per shape and system, GFLOP/s rounded to 0.1.                                                                                                                                                                                                                    |
| `fusion-block.json`     | computed with the repository's code (below) | ResNet-50's `layer1.1` bottleneck fused and unfused: each kernel's operators and arguments (shape, bytes, storage kind), bytes moved and arena size.                                                                                                                             |
| `matmul-schedules.json` | computed with the repository's code (below) | The matmul template's knob space and defaults, its trace and loop IR at the defaults, and a hash of the trace and loop IR at every point of the space. Test fixture only; the page does not load it.                                                                             |

## Computed files

Both were produced in a clone of the repository at the commit above (`uv sync --no-dev`), with
no tuning or benchmark run.

**`matmul-schedules.json`.** The workload `c_workloads.matmul(64, 128, 256)` from
`tests/c/c_workloads.py` is `relu(A @ W + b)` with A of 64 x 256 and W of 256 x 128, the kernel
`docs/cpu.md` prints as generated C. Its group was scheduled by the C backend's `matmul`
template for `Target(kind="c", isa="generic", num_threads=4)` at every point of
`space_of(template)` (224 configurations), and `tir.script(sch.func)` and `sch.trace` were
recorded. Lines starting with `reads(`, `writes(` or `annotate(` are removed, as in the snippets
of `docs/tir.md`. Each hash is FNV-1a (64-bit) of the UTF-8 text `"\n".join(trace) + "\n\n" +
script`, keyed `tile_m,tile_n,order,pack_b,parallel` with booleans as 0 or 1.

**`fusion-block.json`.** ResNet-50's second bottleneck block of its first stage (`layer1.1`),
rebuilt with the model's shapes in the layout the optimized model uses (NHWC activations, HWIO
weights) and the node names of the exported model: a 1 x 1 convolution from 256 to 64
channels, ReLU, a 3 x 3 convolution (padding 1), ReLU, a 1 x 1 convolution back to 256
channels, the residual Add and a ReLU, on a 56 x 56 image. The graph went through
`passes.optimize`, then `passes.fuse` with fusion on and off, then `passes.plan_memory`. Bytes
moved is the sum over kernels of the bytes of every argument, the definition in
`src/tessera/bench/models.py`. The weights are random; fusion depends only on the graph.
