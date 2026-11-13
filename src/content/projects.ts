import type { MinorProject, Project } from "./types";

const gh = (repo: string) => `https://github.com/${repo}`;

// Flagship projects, in the order the home page shows them. Every number is from the project's
// README or committed results (docs/site.md lists the sources).
export const projects: Project[] = [
  {
    slug: "pulse",
    name: "Pulse",
    kicker: "Hardware · SystemVerilog",
    tagline: "A RISC-V SoC with an INT8 systolic-array NPU.",
    summary:
      "A 5-stage pipelined RV32IM CPU driving an 8×8 INT8 systolic-array NPU with its own DMA, " +
      "checked instruction by instruction against a C++ reference simulator and closed at 40 MHz " +
      "on an ECP5 FPGA.",
    stats: [
      { value: "115×", label: "faster MNIST on the NPU than the CPU" },
      { value: "58.9", label: "of 64 MACs per cycle on a full tile" },
      { value: "2.86", label: "CoreMark/MHz, 114 iterations/s at 40 MHz" },
    ],
    tags: ["SystemVerilog", "Verilator", "cocotb", "RISC-V", "ECP5", "C++"],
    repo: gh("MatiiiBL/riscv-npu-soc"),
    links: [
      { label: "Design spec", href: `${gh("MatiiiBL/riscv-npu-soc")}/blob/main/docs/spec.md` },
      { label: "NPU notes", href: `${gh("MatiiiBL/riscv-npu-soc")}/blob/main/docs/npu.md` },
    ],
    date: "Nov 2026",
  },
  {
    slug: "apex",
    name: "Apex",
    kicker: "Robotics · C++20",
    tagline: "An autonomous Formula Student Driverless stack, and the simulator it races in.",
    summary:
      "On a track it has never seen, lap 1 maps the cones with LiDAR, camera and EKF-SLAM; laps " +
      "2–10 race a minimum-curvature raceline with model predictive control. Every algorithm is " +
      "written from scratch, down to the QP solvers.",
    stats: [
      { value: "33/33", label: "ten-lap runs on unseen tracks, no cone hit" },
      { value: "1.4 cm", label: "median cone-map error after lap 1" },
      { value: "341 µs", label: "MPC p99 on one core (budget 2 ms)" },
    ],
    tags: ["C++20", "EKF-SLAM", "MPC", "Eigen", "CMake", "507 tests"],
    repo: gh("MatiiiBL/apex-driverless"),
    links: [
      { label: "Design", href: `${gh("MatiiiBL/apex-driverless")}/blob/main/docs/design.md` },
      {
        label: "Evaluation",
        href: `${gh("MatiiiBL/apex-driverless")}/blob/main/docs/evaluation.md`,
      },
    ],
    date: "Nov 2026",
  },
  {
    slug: "vecdex",
    name: "vecdex",
    kicker: "Vector search · C++20",
    tagline: "Approximate nearest-neighbor search on HNSW graphs.",
    summary:
      "HNSW vector search with NEON SIMD distance kernels, a multithreaded build, crash-safe " +
      "save/load and zero-copy NumPy bindings, benchmarked against FAISS and hnswlib on the same " +
      "harness.",
    stats: [
      { value: "18.0K", label: "queries/s at 96.4% recall@10 on SIFT1M" },
      { value: "1.78×", label: "FAISS HNSW with the same parameters" },
      { value: "28 s", label: "to build a 1M-vector index on 10 threads" },
    ],
    tags: ["C++20", "NEON", "pybind11", "libFuzzer", "TSan"],
    repo: gh("MatiiiBL/HNSW_vector_search"),
    links: [
      {
        label: "Benchmark results",
        href: `${gh("MatiiiBL/HNSW_vector_search")}/tree/main/bench/results`,
      },
      {
        label: "Index file format",
        href: `${gh("MatiiiBL/HNSW_vector_search")}/blob/main/docs/FORMAT.md`,
      },
    ],
    date: "Oct 2026",
  },
  {
    slug: "minillm",
    name: "minillm",
    kicker: "LLM inference · C++20",
    tagline: "A Llama-architecture inference engine, from scratch.",
    summary:
      "Runs SmolLM2-135M end to end. Every kernel exists twice: a scalar reference checked " +
      "against PyTorch, and a fast one checked against the reference.",
    stats: [
      { value: "Exact", label: "greedy-token match with PyTorch" },
      { value: "3.8×", label: "smaller weights with Q8_0 (538 → 143 MB)" },
      { value: "3", label: "sanitizers in CI: ASan, UBSan, TSan" },
    ],
    tags: ["C++20", "safetensors", "bf16", "Q8_0", "doctest"],
    repo: gh("MatiiiBL/LLM-inference-engine"),
    links: [
      {
        label: "Measured errors",
        href: `${gh("MatiiiBL/LLM-inference-engine")}/blob/main/tests/common/tolerances.h`,
      },
      {
        label: "Oracle generator",
        href: `${gh("MatiiiBL/LLM-inference-engine")}/blob/main/oracle/generate.py`,
      },
    ],
    date: "Oct 2026",
  },
  {
    slug: "tessera",
    name: "Tessera",
    kicker: "ML compiler · Python",
    tagline: "A tensor compiler for Apple silicon.",
    summary:
      "ONNX models are fused, lowered to a TensorIR-style loop IR, scheduled by an autotuner " +
      "with a learned cost model, and compiled to C with NEON and SME microkernels or to Metal.",
    stats: [
      { value: "4/4", label: "models where its Metal backend beats every baseline" },
      { value: "1.56×", label: "faster GPT-2 than PyTorch on the M4 GPU" },
      { value: "3e-6", label: "max relative error against ONNX Runtime" },
    ],
    tags: ["Python", "C", "NEON · SME", "Metal", "ONNX", "1,374 tests"],
    repo: gh("MatiiiBL/tessera"),
    links: [
      { label: "Design", href: `${gh("MatiiiBL/tessera")}/blob/main/docs/design.md` },
      { label: "Evaluation", href: `${gh("MatiiiBL/tessera")}/blob/main/docs/evaluation.md` },
    ],
    date: "Nov 2026",
  },
  {
    slug: "precis",
    name: "Précis",
    kicker: "LLM agents · Python",
    tagline: "Parallel LLM agents that read and verify research papers.",
    summary:
      "A reader agent navigates each paper with tools, a critic checks every claim against a " +
      "verbatim quote, and failed claims are rewritten and checked again, thousands of papers " +
      "in parallel behind one rate-limit-aware gateway.",
    stats: [
      { value: "166", label: "papers/min under simulated API rate limits" },
      { value: "0", label: "requests paid twice after a SIGKILL" },
      { value: "2,896", label: "arXiv papers parsed (99.2%)" },
    ],
    tags: ["Python", "asyncio", "SQLite", "mypy --strict", "486 tests"],
    repo: gh("MatiiiBL/precis"),
    links: [
      { label: "Design", href: `${gh("MatiiiBL/precis")}/blob/main/docs/design.md` },
      { label: "Evaluation", href: `${gh("MatiiiBL/precis")}/blob/main/docs/evaluation.md` },
    ],
    date: "Nov 2026",
  },
];

export const minorProjects: MinorProject[] = [
  {
    name: "memo",
    kicker: "Robotics · assistive hardware",
    award: "AI category winner · makeCU",
    summary:
      "A tendon-driven glove (5 servos) that helps stroke patients open their hand, with a " +
      "virtual target hand, a voice coach and a doctor view.",
    role: "I owned the webcam hand tracking: MediaPipe finger-flexion measurement, calibration and temporal filtering.",
    tags: ["ESP32", "MediaPipe", "TypeScript", "Python"],
    repo: gh("MateoVidalS/makecu-guante"),
  },
  {
    name: "WattsGood",
    kicker: "Multi-agent LLM app",
    award: "1st place · 8-hour hackathon",
    summary:
      "Three orchestrated Claude agents (eligibility parsing, program matching, plain-language " +
      "explanation) connect low-income households to unclaimed energy assistance.",
    role: "Built with a 4-person team.",
    tags: ["JavaScript", "React", "Claude API"],
    repo: gh("MatiiiBL/housing-energy-assistance"),
  },
  {
    name: "ShellC",
    kicker: "Systems · POSIX",
    summary:
      "A bash-like Unix shell in C: quote-aware parser, builtins, fork/exec with exit-status " +
      "reporting, SIGPIPE handling, and byte-at-a-time stdin so child processes share input. " +
      "No heap allocation.",
    tags: ["C", "POSIX", "make"],
    repo: gh("MatiiiBL/ShellC"),
  },
];

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
