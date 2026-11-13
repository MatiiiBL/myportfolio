import { LineChart } from "../../components/charts";
import bench from "./data/bench-throughput.json";
import faults from "./data/bench-faults.json";

const REPO = "https://github.com/MatiiiBL/precis/blob/main";

function SourceLink({ path, label }: { path: string; label?: string }) {
  return <a href={`${REPO}/${path}`}>{label ?? path}</a>;
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const n = (x: number) => x.toLocaleString("en-US");

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
                  placement: "below-left",
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
            Source: <SourceLink path="results/bench-throughput.md" />.
          </>
        }
      />
      <div className="dive-table-wrap">
        <table className="dive-table">
          <caption>The same runs: rates against the limits and paper latency.</caption>
          <thead>
            <tr>
              <th scope="col">Ceiling</th>
              <th scope="col">Papers/min</th>
              <th scope="col">Requests/min</th>
              <th scope="col">Input tokens used</th>
              <th scope="col">429s</th>
              <th scope="col">p50 / p95 paper, min</th>
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
        <p className="dive-source">
          Source: <SourceLink path="results/bench-throughput.md" />.
        </p>
      </div>
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
    <div className="dive-table-wrap">
      <table className="dive-table dive-table-pairs">
        <caption>
          Killed with SIGKILL partway through, with 4% 429, 2% 529, 2% 500 and 1% timeouts injected,
          then resumed (offline).
        </caption>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="dive-source">
        Source: <SourceLink path="results/bench-faults.md" />.
      </p>
    </div>
  );
}

export function CorpusResults() {
  return (
    <div className="dive-table-wrap">
      <table className="dive-table dive-table-pairs">
        <caption>The real corpus: arXiv cs.AR, July 2025 to October 2026.</caption>
        <tbody>
          <tr>
            <th scope="row">Papers found</th>
            <td>2,918</td>
          </tr>
          <tr>
            <th scope="row">Parsed from arXiv&apos;s HTML</th>
            <td>2,670 (91.5%)</td>
          </tr>
          <tr>
            <th scope="row">Parsed from the PDF</th>
            <td>226 (7.7%)</td>
          </tr>
          <tr>
            <th scope="row">Failed (withdrawn, garbled, too short)</th>
            <td>22 (0.8%)</td>
          </tr>
          <tr>
            <th scope="row">Median paper, tokens</th>
            <td>8,670</td>
          </tr>
          <tr>
            <th scope="row">Whole pipeline offline (2,889 papers)</th>
            <td>42 s, 14,063 requests</td>
          </tr>
        </tbody>
      </table>
      <p className="dive-source">
        Source: <SourceLink path="docs/ingest.md#the-full-corpus" label="docs/ingest.md" /> and the{" "}
        <SourceLink path="README.md#results" label="README" />.
      </p>
    </div>
  );
}

export function StrategyResults() {
  return (
    <div className="dive-table-wrap">
      <table className="dive-table">
        <caption>Three ways to read a paper, offline, 200 synthetic papers (read stage).</caption>
        <thead>
          <tr>
            <th scope="col">Strategy</th>
            <th scope="col">Requests / paper</th>
            <th scope="col">Tokens / paper, median</th>
            <th scope="col">Share of the body read</th>
            <th scope="col">Extra tokens per body token</th>
            <th scope="col">Cost, 200 papers</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Agentic (tools)</th>
            <td>2.21</td>
            <td>10,750</td>
            <td>53%</td>
            <td>0.45</td>
            <td>$7.45</td>
          </tr>
          <tr>
            <th scope="row">Full text</th>
            <td>1</td>
            <td>9,999</td>
            <td>100%</td>
            <td>1.00</td>
            <td>$8.93</td>
          </tr>
          <tr>
            <th scope="row">Map-reduce</th>
            <td>2.71</td>
            <td>11,655</td>
            <td>100%</td>
            <td>1.10</td>
            <td>$10.71</td>
          </tr>
        </tbody>
      </table>
      <p className="dive-source">
        Costs are what the simulated usage would cost at Claude Opus 5.5 prices; nothing was paid.
        Source: <SourceLink path="docs/agents.md#7-measurements-offline" label="docs/agents.md" />.
      </p>
    </div>
  );
}
