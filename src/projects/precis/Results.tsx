import type { ReactNode } from "react";
import { LineChart } from "../../components/charts";
import bench from "./data/bench-throughput.json";
import faults from "./data/bench-faults.json";
import { SourceLink } from "./SourceLink";

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => x.toLocaleString("en-US");

function TableWrap({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="project-table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export function ThroughputResults() {
  const at128 = bench.points.find((p) => p.concurrency === 128);
  return (
    <>
      <LineChart
        title="Throughput against the concurrency ceiling"
        subtitle="2,000 papers · read, verify, revise · simulated limits and latency · log scale"
        x={{
          type: "log",
          label: "concurrency ceiling",
          ticks: bench.points.map((p) => p.concurrency),
          format: (v) => String(v),
        }}
        y={{
          type: "linear",
          label: "papers per minute",
          domain: [0, 200],
          format: (v) => v.toFixed(1),
        }}
        series={[
          {
            id: "papers",
            label: "Papers per minute",
            points: bench.points.map((p) => ({
              x: p.concurrency,
              y: p.papers_per_minute,
              note: `${pct(p.input_tokens_per_minute / bench.itpm_limit)} of the input-token limit, p95 paper ${(p.paper_latency_p95_s / 60).toFixed(1)} min`,
            })),
            color: 1,
          },
        ]}
        annotations={
          at128
            ? [
                {
                  x: 128,
                  y: at128.papers_per_minute,
                  label: "input-token limit binds",
                  note: `${pct(at128.input_tokens_per_minute / bench.itpm_limit)} of 2M tokens/min, no 429s`,
                  placement: "below-right",
                },
              ]
            : []
        }
        caption={
          <>
            Offline: the real scheduler, agents and gateway against a fake API with 4,000 requests,
            2 million input and 400,000 output tokens per minute, and 2 s to the first token plus 20
            ms per output token. Up to a ceiling of 64, throughput grows with concurrency (about 1.9
            papers per minute per slot); from 128 the input-token limit holds it at 165 to 166.
            Source: <SourceLink file="results/bench-throughput.md" />.
          </>
        }
      />
      <TableWrap label="Throughput benchmark at every ceiling">
        <table className="project-table">
          <caption>The same runs: rates against the limits, and paper latency</caption>
          <thead>
            <tr>
              <th scope="col">Ceiling</th>
              <th scope="col">Papers/min</th>
              <th scope="col">Requests/min</th>
              <th scope="col">Input tokens used</th>
              <th scope="col">429s</th>
              <th scope="col">Paper p50 / p95, min</th>
            </tr>
          </thead>
          <tbody>
            {bench.points.map((p) => (
              <tr key={p.concurrency}>
                <th scope="row">{p.concurrency}</th>
                <td>{p.papers_per_minute.toFixed(1)}</td>
                <td>{Math.round(p.requests_per_minute)}</td>
                <td>{pct(p.input_tokens_per_minute / bench.itpm_limit)}</td>
                <td>{p.rate_limited}</td>
                <td>
                  {(p.paper_latency_p50_s / 60).toFixed(1)} /{" "}
                  {(p.paper_latency_p95_s / 60).toFixed(1)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="project-source">
        Source: <SourceLink file="results/bench-throughput.md" />.
      </p>
    </>
  );
}

export function FaultResults() {
  const rows: [string, string][] = [
    ["Papers", n(faults.papers)],
    ["Finished when the first run was killed", n(faults.finished_at_kill)],
    ["Stages running at the kill", n(faults.running_at_kill)],
    ["Requests in flight at the kill", n(faults.in_flight_at_kill)],
    ["Requests in the resumed run", n(faults.resumed_calls)],
    ["… served from the cache", n(faults.resumed_cached_calls)],
    ["… sent again (in flight at the kill)", n(faults.resent_requests)],
    ["Retries in both runs", n(faults.retries)],
    [
      "Papers done / failed / lost",
      `${faults.papers_done} / ${faults.papers_failed} / ${faults.papers_lost}`,
    ],
    ["Requests paid for twice", n(faults.paid_twice)],
  ];
  return (
    <div>
      <TableWrap label="Crash recovery benchmark">
        <table className="project-table">
          <caption>SIGKILL mid-run with 9% of requests failing, then a resume</caption>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="project-source">
        Injected per request: 4% 429, 2% 529, 2% 500, 1% timeouts. Offline. Source:{" "}
        <SourceLink file="results/bench-faults.md" />.
      </p>
    </div>
  );
}

export function CorpusResults() {
  const rows: [string, string][] = [
    ["Papers found", "2,918"],
    ["Parsed from arXiv's HTML", "2,670 (91.5%)"],
    ["Parsed from the PDF", "226 (7.7%)"],
    ["Failed: withdrawn, garbled or too short", "22 (0.8%)"],
    ["Median paper, tokens", "8,670"],
    ["Whole pipeline offline, 2,889 papers", "42 s"],
  ];
  return (
    <div>
      <TableWrap label="The real corpus">
        <table className="project-table">
          <caption>arXiv cs.AR, July 2025 to October 2026</caption>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="project-source">
        Downloaded from arXiv itself. Source:{" "}
        <SourceLink file="docs/ingest.md" anchor="the-full-corpus" /> and the{" "}
        <SourceLink file="README.md" anchor="results" />.
      </p>
    </div>
  );
}

export function StrategyResults() {
  const rows: [string, string, string, string, string, string][] = [
    ["Agentic (tools)", "2.21", "10,750", "53%", "0.45", "$7.45"],
    ["Full text", "1", "9,999", "100%", "1.00", "$8.93"],
    ["Map-reduce", "2.71", "11,655", "100%", "1.10", "$10.71"],
  ];
  return (
    <>
      <TableWrap label="Reading strategies">
        <table className="project-table">
          <caption>Three ways to read a paper (read stage, 200 synthetic papers, offline)</caption>
          <thead>
            <tr>
              <th scope="col">Strategy</th>
              <th scope="col">Requests / paper</th>
              <th scope="col">Tokens / paper, median</th>
              <th scope="col">Body read</th>
              <th scope="col">Tokens per extra body token</th>
              <th scope="col">Cost, 200 papers</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, ...cells]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                {cells.map((c, i) => (
                  <td key={i}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <p className="project-source">
        Costs are what the simulated usage would cost at Claude Opus 5.5 prices; nothing was paid.
        Source: <SourceLink file="docs/agents.md" anchor="7-measurements-offline" />.
      </p>
    </>
  );
}
