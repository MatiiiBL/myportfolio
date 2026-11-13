import type { Experience, Profile, ToolboxRow } from "./types";

export const profile: Profile = {
  name: "Matías Blanco",
  headline: "Computer Engineering · Columbia University",
  pitch: "I build fast, verified systems from scratch.",
  status: "Computer Engineering student at Columbia University",
  // The home page shows the hero's focus line (below) and the experience timeline right above
  // the About section, so the intro and the personal note do not repeat them.
  intro:
    "I'm a Computer Engineering student at Columbia (AI minor, class of 2029), originally from " +
    "Montevideo. I like problems where the system has to be fast and right, from RTL and " +
    "robotics to ML compilers and LLM pipelines.",
  about: [
    "I grew up in Montevideo, Uruguay. Away from a keyboard you'll find me swimming, playing " +
      "soccer with friends, or sharing mate, Uruguay's national drink.",
  ],
  education: {
    school: "Columbia University, School of Engineering and Applied Science",
    degree: "B.S. Computer Engineering",
    minor: "Minor in Artificial Intelligence",
    graduation: "May 2029",
  },
  location: "New York, NY",
  email: "matias.blancobalaguer@columbia.edu",
  links: {
    github: "https://github.com/MatiiiBL",
    linkedin: "https://www.linkedin.com/in/matias-blanco-uy/",
  },
  languages: [
    { name: "Spanish", level: "native" },
    { name: "English", level: "fluent" },
    { name: "Portuguese", level: "advanced" },
    { name: "Chinese", level: "learning" },
  ],
  activities: ["Columbia Formula Racing"],
  siteUrl: "https://matiiibl.github.io/myportfolio/",
};

/** The one-line focus statement under the pitch on the home page: how I work. */
export const focus =
  "I profile before I optimize, check every fast path against a slow reference, and benchmark " +
  "against the libraries people already use.";

export const experience: Experience[] = [
  {
    org: "Forva Systems",
    role: "AI Engineer",
    place: "New York",
    period: "Dec 2025 – Oct 2026",
    summary:
      "AI backend of an EMS platform for EMTs and paramedics. I designed the anti-hallucination " +
      "guardrails for clinical LLM extraction (schema-constrained outputs, verbatim-quote " +
      "provenance, gap-aware context windows, human sign-off on every medication) and a " +
      "dev/held-out eval harness that scores word error rate, medical-term survival and number " +
      "grounding.",
  },
  {
    org: "Y Combinator Startup School",
    role: "Selected participant",
    place: "San Francisco",
    period: "Jul 2026",
    summary:
      "Picked from 30,000+ applicants. In the 48-hour build sprint I wrote an agentic Python " +
      "pipeline that runs parallel LLM summarization over 2,000+ research PDFs.",
  },
  {
    org: "AdAstra",
    role: "Software Engineer Intern",
    place: "Montevideo",
    period: "Sep – Dec 2024",
    summary:
      "Full-stack social platform in C#, React, PostgreSQL and Python. Deployed Gemma 3 " +
      "on-premise to flag AI-generated images and stop fraud.",
  },
];

export const toolbox: ToolboxRow[] = [
  {
    area: "Hardware",
    items: ["SystemVerilog", "RISC-V", "Verilator", "cocotb", "Yosys / nextpnr", "ECP5 FPGA"],
  },
  { area: "Robotics", items: ["EKF-SLAM", "MPC", "QP solvers", "motion planning", "Eigen"] },
  { area: "Systems", items: ["C++20", "C", "CMake", "NEON / SME SIMD", "POSIX", "Linux"] },
  {
    area: "Correctness",
    items: ["ASan", "UBSan", "TSan", "libFuzzer", "Valgrind", "GitHub Actions"],
  },
  {
    area: "ML",
    items: ["PyTorch", "ONNX", "Metal", "NumPy", "pybind11", "MediaPipe", "LLM agents & evals"],
  },
  {
    area: "Product",
    items: ["TypeScript", "React", "Node.js", "C# / ASP.NET Core", "PostgreSQL", "Flutter"],
  },
];
