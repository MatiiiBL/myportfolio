import { BarChart, LineChart } from "../../components/charts";
import models from "./data/models.json";
import tuning from "./data/tuning.json";
import gemm from "./data/gemm.json";

const REPO = "https://github.com/MatiiiBL/tessera/blob/main";
const MIB = 1024 * 1024;

type Latency = { median: number; p10: number; p90: number; maxRel: number };
type SystemName =
  | "onnxruntime-cpu"
  | "pytorch-cpu"
  | "pytorch-mps"
  | "tessera-c:sme"
  | "tessera-c:sme-untuned"
  | "tessera-metal"
  | "tessera-metal-untuned";

const rows = models.models.map((m) => ({
  name: m.name,
  system: (s: SystemName) => (m.systems as Record<string, Latency>)[s] as Latency,
  ablations: m.ablations,
}));

const ms = (x: number) => x.toFixed(2);
const times = (x: number) => `${x.toFixed(2)}×`;

function vsOnnxRuntime(system: SystemName): number[] {
  return rows.map((r) => r.system("onnxruntime-cpu").median / r.system(system).median);
}

const LATENCY_COLUMNS: [SystemName, string][] = [
  ["onnxruntime-cpu", "ONNX Runtime CPU"],
  ["pytorch-cpu", "PyTorch CPU"],
  ["pytorch-mps", "PyTorch MPS"],
  ["tessera-c:sme", "Tessera CPU"],
  ["tessera-metal", "Tessera GPU"],
];

function SourceLink({ path }: { path: string }) {
  return <a href={`${REPO}/${path}`}>{path}</a>;
}

export function LatencyResults() {
  return (
    <>
      <BarChart
        title="Speed relative to ONNX Runtime on the CPU"
        subtitle="Apple M4 · batch 1 · float32 · higher is faster"
        categories={rows.map((r) => r.name)}
        categoryLabel="Model"
        series={[
          { id: "mps", label: "PyTorch MPS", values: vsOnnxRuntime("pytorch-mps"), color: "muted" },
          {
            id: "sme",
            label: "Tessera CPU (c:sme)",
            values: vsOnnxRuntime("tessera-c:sme"),
            color: 2,
          },
          {
            id: "metal",
            label: "Tessera GPU (Metal)",
            values: vsOnnxRuntime("tessera-metal"),
            color: 1,
          },
        ]}
        value={{ type: "linear", label: "times ONNX Runtime's speed", format: times }}
        references={[{ value: 1, label: "ONNX Runtime" }]}
        caption={
          <>
            ONNX Runtime&apos;s median latency divided by each system&apos;s, so 2× is twice as
            fast. Medians of at least 50 runs, Tessera with its committed tuning logs;
            Tessera&apos;s CPU runs are pooled from five fresh processes. Source:{" "}
            <SourceLink path="results/models.md" />.
          </>
        }
      />
      <div className="dive-table-wrap">
        <table className="dive-table">
          <caption>
            Median latency in milliseconds (lower is better); the fastest system in bold.
          </caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              {LATENCY_COLUMNS.map(([key, label]) => (
                <th key={key} scope="col">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const best = Math.min(...LATENCY_COLUMNS.map(([k]) => r.system(k).median));
              return (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  {LATENCY_COLUMNS.map(([key]) => {
                    const v = r.system(key).median;
                    return <td key={key}>{v === best ? <strong>{ms(v)}</strong> : ms(v)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="dive-source">
          Source: <SourceLink path="results/models.md" />, measured 2026-11-12 at commit{" "}
          <code>{models.commit}</code>.
        </p>
      </div>
    </>
  );
}

// Every fourth measurement: the curves are best-so-far steps, so nothing visible is lost.
function curve(values: number[]) {
  return values.map((y, i) => ({ x: i + 1, y })).filter((p) => p.x === 1 || p.x % 4 === 0);
}

export function TuningResults() {
  const task = tuning.synthetic[0];
  if (!task) return null;
  const at = (values: number[], n: number) => values[n - 1] ?? 0;
  return (
    <>
      <LineChart
        title="Best schedule found, by search strategy"
        subtitle="synthetic 64×64×64 matmul · 43,904 configurations · mean of 5 seeds"
        x={{
          type: "linear",
          label: "measurements",
          domain: [1, 256],
          ticks: [1, 64, 128, 192, 256],
        }}
        y={{
          type: "linear",
          label: "throughput / optimum",
          domain: [0, 1],
          format: (v) => v.toFixed(3),
        }}
        series={[
          { id: "model", label: "Model-guided search", points: curve(task.curves.model), color: 1 },
          {
            id: "random",
            label: "Random search",
            points: curve(task.curves.random),
            color: "muted",
          },
        ]}
        endLabels
        caption={
          <>
            The best throughput found after each measurement, relative to the space&apos;s optimum
            (found exhaustively, since the synthetic task&apos;s costs are analytic). After 64
            measurements the model-guided search is at {at(task.curves.model, 64).toFixed(2)} of the
            optimum and random search at {at(task.curves.random, 64).toFixed(2)}. Source:{" "}
            <SourceLink path="results/tuning.md" />.
          </>
        }
      />
      <div className="dive-table-wrap">
        <table className="dive-table">
          <caption>Median latency in milliseconds, template defaults and tuned.</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">CPU default</th>
              <th scope="col">CPU tuned</th>
              <th scope="col">GPU default</th>
              <th scope="col">GPU tuned</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>{ms(r.system("tessera-c:sme-untuned").median)}</td>
                <td>{ms(r.system("tessera-c:sme").median)}</td>
                <td>{ms(r.system("tessera-metal-untuned").median)}</td>
                <td>{ms(r.system("tessera-metal").median)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="dive-source">
          Source: <SourceLink path="results/models.md" />; the logs are{" "}
          <SourceLink path="results/tuning" />.
        </p>
      </div>
    </>
  );
}

export function FusionResults() {
  return (
    <div className="dive-table-wrap">
      <table className="dive-table">
        <caption>Fusion on whole models: kernels, bytes moved and memory.</caption>
        <thead>
          <tr>
            <th scope="col">Model</th>
            <th scope="col">Kernels, fused / off</th>
            <th scope="col">Bytes moved, MiB</th>
            <th scope="col">Arena / intermediates, MiB</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const full = r.ablations["c:sme"].full;
            const off = r.ablations["c:sme"]["fusion off"];
            const mib = (b: number) => (b / MIB).toFixed(1);
            return (
              <tr key={r.name}>
                <th scope="row">{r.name}</th>
                <td>
                  {full.kernels} / {off.kernels}
                </td>
                <td>
                  {mib(full.bytesMoved)} / {mib(off.bytesMoved)}
                </td>
                <td>
                  {mib(full.arena)} / {mib(full.intermediates)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="dive-source">
        Bytes moved is the sum over kernel launches of the bytes of every argument, a lower bound on
        memory traffic. Source: <SourceLink path="results/models.md" />.
      </p>
    </div>
  );
}

const GEMM_SHAPES = [
  "1024x1024x1024",
  "2048x2048x2048",
  "128x768x768",
  "128x3072x768",
  "128x768x3072",
  "128x50257x768",
];

export function KernelResults() {
  const byShape = new Map(gemm.gemm.map((g) => [g.shape, g as Record<string, number | string>]));
  const cell = (row: Record<string, number | string> | undefined, key: string) => {
    const v = row?.[key];
    return typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "";
  };
  return (
    <div className="dive-table-wrap">
      <table className="dive-table">
        <caption>Float32 GEMM throughput, GFLOP/s (C = A × B, B constant; M×N×K).</caption>
        <thead>
          <tr>
            <th scope="col">Shape</th>
            <th scope="col">NumPy (Accelerate)</th>
            <th scope="col">Tessera CPU</th>
            <th scope="col">PyTorch MPS</th>
            <th scope="col">Tessera GPU</th>
          </tr>
        </thead>
        <tbody>
          {GEMM_SHAPES.map((shape) => {
            const row = byShape.get(shape);
            return (
              <tr key={shape}>
                <th scope="row">{shape.replaceAll("x", "×")}</th>
                <td>{cell(row, "numpy")}</td>
                <td>{cell(row, "tessera-c:sme")}</td>
                <td>{cell(row, "pytorch-mps")}</td>
                <td>{cell(row, "tessera-metal")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="dive-source">
        Source: <SourceLink path="results/ops.md" />.
      </p>
    </div>
  );
}
