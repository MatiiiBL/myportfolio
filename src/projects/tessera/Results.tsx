import type { ReactNode } from "react";
import { BarChart, LineChart } from "../../components/charts";
import models from "./data/models.json";
import tuning from "./data/tuning.json";
import gemm from "./data/gemm.json";
import { SourceLink } from "./SourceLink";

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

function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="project-table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
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
            <SourceLink file="results/models.md" />.
          </>
        }
      />
      <TableWrap label="Median latency of each model and system">
        <table className="project-table">
          <caption>Median latency, ms (lower is better; the fastest in bold)</caption>
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
      </TableWrap>
      <p className="project-source">
        Measured 2026-11-12 at commit <code>{models.commit}</code>. Source:{" "}
        <SourceLink file="results/models.md" />.
      </p>
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
            <SourceLink file="results/tuning.md" />.
          </>
        }
      />
      <TableWrap label="Latency with the template defaults and tuned">
        <table className="project-table">
          <caption>Median latency, ms: template defaults and tuned</caption>
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
      </TableWrap>
      <p className="project-source">
        Source: <SourceLink file="results/models.md" />; the tuning logs are in{" "}
        <SourceLink file="results/tuning" />.
      </p>
    </>
  );
}

export function FusionResults() {
  const mib = (b: number) => (b / MIB).toFixed(1);
  return (
    <div>
      <TableWrap label="Fusion on whole models">
        <table className="project-table">
          <caption>Fusion on whole models</caption>
          <thead>
            <tr>
              <th scope="col">Model</th>
              <th scope="col">Kernels, fused / off</th>
              <th scope="col">MiB moved, fused / off</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const full = r.ablations["c:sme"].full;
              const off = r.ablations["c:sme"]["fusion off"];
              return (
                <tr key={r.name}>
                  <th scope="row">{r.name}</th>
                  <td>
                    {full.kernels} / {off.kernels}
                  </td>
                  <td>
                    {mib(full.bytesMoved)} / {mib(off.bytesMoved)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      <p className="project-source">
        Bytes moved: the sum over kernel launches of every argument&apos;s bytes, a lower bound on
        memory traffic. Source: <SourceLink file="results/models.md" />.
      </p>
    </div>
  );
}

const GEMM_SHAPES = [
  "1024x1024x1024",
  "2048x2048x2048",
  "128x768x768",
  "128x3072x768",
  "128x50257x768",
];

export function KernelResults() {
  const byShape = new Map(gemm.gemm.map((g) => [g.shape, g as Record<string, number | string>]));
  const cell = (row: Record<string, number | string> | undefined, key: string) => {
    const v = row?.[key];
    return typeof v === "number" ? v.toLocaleString("en-US", { maximumFractionDigits: 0 }) : "";
  };
  return (
    <div>
      <TableWrap label="GEMM throughput">
        <table className="project-table">
          <caption>Float32 GEMM, GFLOP/s (M×N×K)</caption>
          <thead>
            <tr>
              <th scope="col">Shape</th>
              <th scope="col">Accelerate</th>
              <th scope="col">Tessera CPU</th>
              <th scope="col">MPS</th>
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
      </TableWrap>
      <p className="project-source">
        C = A × B with B constant; Accelerate through NumPy, MPS through PyTorch. Source:{" "}
        <SourceLink file="results/ops.md" />.
      </p>
    </div>
  );
}
