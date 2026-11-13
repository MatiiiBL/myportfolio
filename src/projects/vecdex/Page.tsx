import type { ReactNode } from "react";
import { Figure } from "../../components/Figure";
import { Section } from "../../components/Section";
import { BarChart, LineChart, formatNumber, type LineSeries } from "../../components/charts";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import { HnswExplorer } from "./HnswExplorer";
import { PrefetchDiagram } from "./PrefetchDiagram";
import { EXPLORER_GRAPH } from "./explorerGraph";
import cppHarness from "./data/cpp-harness.json";
import optimizations from "./data/optimizations.json";
import comparison from "./data/python-comparison.json";
import threads from "./data/threads.json";
import "./page.css";

// The vecdex page body, inside ProjectLayout (docs/site.md, "Project pages"). Every number is
// from the repository at the commit in data/SOURCE.md.
const REPO = "https://github.com/MatiiiBL/HNSW_vector_search";
const AT = `${REPO}/blob/0f5f719d6d36819883665bdb75c120234da1fc3e`;
const RESULTS = `${REPO}/tree/0f5f719d6d36819883665bdb75c120234da1fc3e/bench/results`;

interface Curve {
  lib: string;
  points: { ef: number; recall: number; qps: number }[];
}

const recallFormat = (v: number) => v.toFixed(3);

function curves(libs: Curve[]): LineSeries[] {
  return libs.map((lib) => ({
    id: lib.lib,
    label: lib.lib,
    points: lib.points.map((p) => ({ x: p.recall, y: p.qps, note: `ef = ${p.ef}` })),
  }));
}

function at(libs: Curve[], name: string, ef: number) {
  const point = libs.find((l) => l.lib === name)?.points.find((p) => p.ef === ef);
  return point ?? { ef, recall: 0, qps: 0 };
}

function Source({ href, children }: { href: string; children: string }) {
  return (
    <>
      {" "}
      Source: <a href={href}>{children}</a>.
    </>
  );
}

/** A table that scrolls sideways on a phone; focusable so the keyboard can scroll it too. */
function TableScroll({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="vx-table-wrap" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}

export default function Page() {
  const siftBest = at(comparison.sift1m, "vecdex", 64);
  const gloveBest = at(comparison.glove100, "vecdex", 1024);
  const base = threads[0] ?? { buildSeconds: 1, qps: 1 };
  const four = threads.find((t) => t.threads === 4) ?? base;
  return (
    <>
      <Section id="overview" title="Overview">
        <div className="vx-prose">
          <p>
            vecdex is a C++20 library for approximate nearest-neighbor (ANN) search: given a query
            vector, it returns the k stored vectors closest to it without comparing the query
            against all of them. It is built on HNSW (hierarchical navigable small world) graphs,
            with hand-written NEON and AVX2 distance kernels, a multithreaded build, crash-safe save
            and load, and Python bindings that read NumPy arrays in place.
          </p>
          <p>
            The algorithm fits on a page of the paper; the work is in making it fast and measuring
            it fairly. A search is a chain of cache misses: every node it expands points to about 21
            vectors scattered across 512 MB. I profiled before optimizing, and I benchmarked vecdex
            against hnswlib and FAISS on one machine, through one harness, with the same build
            parameters, and even with vecdex&apos;s own distance kernel plugged into hnswlib, so the
            remaining gap measures graph code alone.
          </p>
        </div>
      </Section>

      <Section id="explorer" title="Watch a search" kicker="Interactive">
        <Figure
          title="An HNSW search, step by step"
          subtitle={`${EXPLORER_GRAPH.pointCount} points · M = ${EXPLORER_GRAPH.M} · efConstruction = ${EXPLORER_GRAPH.efConstruction} · k = ${EXPLORER_GRAPH.k}`}
          caption={
            <>
              Each dot is a stored point; the lines are the links of the layer being searched. A
              search starts at the entry point on the top layer and moves greedily toward the query,
              one layer at a time. On layer 0 it runs a best-first search that keeps the ef closest
              nodes found so far (gold rings) and stops when the closest node it has not expanded
              lies outside the circle they span. The graph comes from a TypeScript port of
              vecdex&apos;s insertion code, neighbor-selection heuristic included, and a unit test
              checks it link for link against the graph vecdex itself builds for these points. M is
              4 here, not vecdex&apos;s default of 16, so that 300 points get five layers. Recall
              counts the returned points no farther than the true 10th nearest, as vecdex measures
              it.
            </>
          }
        >
          <HnswExplorer />
        </Figure>
      </Section>

      <Section id="results" title="Results">
        <div className="vx-prose">
          <p>
            Every number below was measured on a 13-inch MacBook Air M4 (4 performance and 6
            efficiency cores, 16 GB), plugged in, one benchmark at a time, with M = 16 and
            efConstruction = 200 for every library. Queries per second (QPS) is the median of 5
            timed passes over 10,000 queries after a warmup, on one thread unless stated.
          </p>
        </div>

        <div className="vx-split">
          <LineChart
            title="SIFT1M: recall against throughput"
            subtitle="1M × 128 · L2 · from Python · 1 thread · log scale"
            x={{ type: "linear", label: "recall@10", format: recallFormat }}
            y={{ type: "log", label: "queries/s" }}
            series={curves(comparison.sift1m)}
            annotations={[
              {
                x: siftBest.recall,
                y: siftBest.qps,
                label: "1.78× FAISS",
                note: "at recall ≥ 0.95",
                placement: "below-left",
              },
            ]}
            caption={
              <>
                Up and to the right is better. Each point is one ef setting; FAISS HNSW 1.15 and
                hnswlib 0.8.0 run from pip, each in its own process.
                <Source href={`${RESULTS}/sift1m`}>bench/results/sift1m/sift-*.csv</Source>
              </>
            }
          />
          <LineChart
            title="GloVe-100: recall against throughput"
            subtitle="1.18M × 100 · cosine · from Python · 1 thread · log scale"
            x={{ type: "linear", label: "recall@10", format: recallFormat }}
            y={{ type: "log", label: "queries/s" }}
            series={curves(comparison.glove100)}
            annotations={[
              {
                x: gloveBest.recall,
                y: gloveBest.qps,
                label: "2.35× FAISS",
                note: "at recall ≥ 0.95",
                placement: "below-left",
              },
            ]}
            caption={
              <>
                A harder dataset: every library needs ef ≈ 1,000 to reach 0.95, and none reaches
                0.99.
                <Source href={`${RESULTS}/glove100`}>bench/results/glove100/*.csv</Source>
              </>
            }
          />
        </div>

        <h3 className="vx-h3">Against hnswlib with the same harness and the same kernel</h3>
        <div className="vx-prose">
          <p>
            On arm64, hnswlib 0.8.0 compiles its SIMD distance functions and every prefetch out, so
            stock hnswlib on a Mac runs a scalar loop with no prefetching. The middle column gives
            hnswlib vecdex&apos;s NEON kernel, which leaves graph-traversal code as the only
            difference. Both libraries build equally good graphs: recall at each ef agrees within
            0.005.
          </p>
        </div>
        <TableScroll label="vecdex and hnswlib, C++ harness">
          <table className="vx-table">
            <caption>SIFT1M, C++ harness, one thread: queries per second at each ef</caption>
            <thead>
              <tr>
                <th scope="col">ef</th>
                <th scope="col">recall@10</th>
                {cppHarness.map((lib) => (
                  <th scope="col" key={lib.lib}>
                    {lib.lib}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[16, 32, 64, 128, 512].map((ef) => (
                <tr key={ef}>
                  <th scope="row">{ef}</th>
                  <td>{recallFormat(at(cppHarness, "vecdex", ef).recall)}</td>
                  {cppHarness.map((lib, i) => (
                    <td key={lib.lib} className={i === 0 ? "vx-strong" : undefined}>
                      {formatNumber(at(cppHarness, lib.lib, ef).qps)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th scope="row">Build</th>
                <td />
                {cppHarness.map((lib, i) => (
                  <td key={lib.lib} className={i === 0 ? "vx-strong" : undefined}>
                    {Math.round(lib.buildSeconds)} s
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </TableScroll>
        <p className="vx-source">
          Recall is vecdex&apos;s; hnswlib&apos;s is within 0.002 of it at every ef shown.
          <Source href={`${RESULTS}/sift1m`}>bench/results/sift1m/cpp-*.csv</Source>
        </p>

        <div className="vx-split">
          <BarChart
            title="Where the speed came from"
            subtitle="SIFT1M · ef = 64 · recall 0.964 · 1 thread"
            categories={optimizations.map((o) => o.version)}
            series={[{ id: "qps", label: "Queries/s", values: optimizations.map((o) => o.qps) }]}
            value={{ type: "linear", label: "queries/s" }}
            categoryLabel="Version"
            emphasis={["Prefetch", "Final"]}
            caption={
              <>
                Each version ran twice, in the order A B C D D C B A so slow thermal drift cancels;
                the bars are the means. Prefetching cut the build from 242 s to 142 s as well.
                <Source href={`${AT}/README.md#where-the-speed-came-from`}>README.md</Source>
              </>
            }
          />
          <LineChart
            title="Multithreaded build and batch search"
            subtitle="SIFT1M · speedup over 1 thread · ef = 64"
            x={{ type: "linear", label: "threads", ticks: [1, 2, 4, 6, 8, 10] }}
            y={{ type: "linear", label: "speedup (×)", format: (v) => `${v.toFixed(2)}×` }}
            series={[
              {
                id: "build",
                label: "Build",
                points: threads.map((t) => ({
                  x: t.threads,
                  y: base.buildSeconds / t.buildSeconds,
                  note: `${t.buildSeconds} s`,
                })),
              },
              {
                id: "search",
                label: "Batch search",
                points: threads.map((t) => ({
                  x: t.threads,
                  y: t.qps / base.qps,
                  note: `${formatNumber(t.qps)} QPS`,
                })),
              },
            ]}
            annotations={[
              {
                x: 4,
                y: base.buildSeconds / four.buildSeconds,
                label: "4 performance cores",
                note: `${(base.buildSeconds / four.buildSeconds).toFixed(1)}× build`,
              },
            ]}
            caption={
              <>
                Past 4 threads each added thread is a slower efficiency core sharing the same memory
                system. Threads claim nodes from a shared counter, so slow cores take fewer instead
                of holding up the end. Recall stays at 0.964 at every thread count.
                <Source href={`${RESULTS}/sift1m`}>
                  bench/results/sift1m/cpp-vecdex-threads-*.csv
                </Source>
              </>
            }
          />
        </div>

        <h3 className="vx-h3">Saving and loading</h3>
        <TableScroll label="Saving and loading">
          <table className="vx-table">
            <caption>The SIFT1M index, 650 MB</caption>
            <thead>
              <tr>
                <th scope="col">Operation</th>
                <th scope="col" className="vx-text">
                  What it does
                </th>
                <th scope="col">Time</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Save</th>
                <td className="vx-text">
                  write, F_FULLFSYNC, atomic rename, directory sync (one run)
                </td>
                <td className="vx-strong">0.41 s</td>
              </tr>
              <tr>
                <th scope="row">Load</th>
                <td className="vx-text">
                  read, XXH64 checksum, full graph validation (median of 3, warm cache)
                </td>
                <td className="vx-strong">0.44 s</td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
        <p className="vx-source">
          Loading the saved index and saving it again gives a byte-identical file, from C++ and from
          Python.
          <Source href={`${AT}/README.md#save-and-load`}>README.md</Source>
        </p>

        <h3 className="vx-h3">Retrieval for RAG</h3>
        <TableScroll label="Retrieval for RAG">
          <table className="vx-table">
            <caption>
              10,570 SQuAD v1.1 questions over its 2,067 paragraphs, embedded with all-MiniLM-L6-v2
              (384-d, cosine)
            </caption>
            <thead>
              <tr>
                <th scope="col">Retriever</th>
                <th scope="col">recall@10 vs exact</th>
                <th scope="col">right paragraph first</th>
                <th scope="col">in top 10</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">FAISS flat (exact)</th>
                <td>1.0000</td>
                <td>0.6229</td>
                <td>0.9167</td>
              </tr>
              <tr>
                <th scope="row">FAISS HNSW</th>
                <td>0.9985</td>
                <td>0.6226</td>
                <td>0.9156</td>
              </tr>
              <tr>
                <th scope="row">vecdex</th>
                <td className="vx-strong">0.9980</td>
                <td className="vx-strong">0.6224</td>
                <td className="vx-strong">0.9149</td>
              </tr>
            </tbody>
          </table>
        </TableScroll>
        <p className="vx-source">
          An approximate index costs almost nothing in answer quality here.
          <Source href={`${AT}/README.md#the-rag-demo`}>README.md</Source>
        </p>
      </Section>

      <Section id="how-it-works" title="How it works">
        <div className="vx-split">
          <div className="vx-prose">
            <p>
              Every vector is a node on layer 0; a random, exponentially thinning fraction also
              lives on layers 1, 2 and up, like the express lanes of a skip list. Vectors sit in one
              contiguous row-major buffer, and each node&apos;s layer-0 links are a fixed-size block
              in one flat array, so following a link never chases a per-node allocation. Ids are
              32-bit.
            </p>
            <p>
              For each node it expands, a search filters the unvisited neighbors (an epoch-stamped
              visited array that resets in O(1)), prefetches all their vectors, then computes
              distances with the NEON kernel and updates two heaps in pooled scratch memory. A warm
              search allocates only the vector it returns.
            </p>
          </div>
          <ArchitectureDiagram />
        </div>

        <ul className="vx-decisions">
          <li>
            <h3>Prefetch every neighbor before computing any distance</h3>
            <div className="vx-split">
              <div className="vx-prose">
                <p>
                  A sampling profile of the first working version put 96% of search time in the
                  layer search and the distance kernel, and the kernel was mostly waiting on memory:
                  each expanded node reads about 21 random 512-byte vectors, a cache miss apiece.
                  Requesting all of them before the first distance lets the misses overlap. Against
                  the version before it, that nearly halved the time per query (1.90×) and cut the
                  build by 41%, without changing the storage format.
                </p>
                <p>
                  It also explains the gap to hnswlib: with vecdex&apos;s kernel, hnswlib runs at
                  9,190 QPS at ef = 64, almost exactly vecdex&apos;s speed before prefetching
                  (9,074). On x86, where hnswlib&apos;s own prefetching is compiled in, the gap may
                  be smaller; that was not measured.
                </p>
              </div>
              <PrefetchDiagram />
            </div>
          </li>
          <li>
            <h3>One lock per node, and never two at once</h3>
            <div className="vx-prose">
              <p>
                A parallel build stores every vector first, then threads claim nodes from an atomic
                counter. Each node&apos;s links have their own mutex, a thread never holds two node
                locks, and a node becomes reachable only after its own links are written, so no
                thread can link to a half-built node. Searches take no locks: a compile-time policy
                keeps the locking code out of <code>search()</code> entirely. ThreadSanitizer finds
                no races, and a parallel build&apos;s recall matched the serial build in every run.
              </p>
            </div>
          </li>
          <li>
            <h3>A durable save and a hostile load</h3>
            <div className="vx-prose">
              <p>
                The index is written to a temporary file, flushed with <code>F_FULLFSYNC</code> (on
                macOS plain <code>fsync</code> leaves data in the drive&apos;s cache), renamed over
                the old one, and then the directory is flushed: a power cut leaves the old index or
                the new one, never neither. Loading treats the file as hostile. Every count is
                checked against the file size before anything is allocated, then the XXH64 checksum,
                then the graph itself (ids in range, no self or duplicate links, consistent layers)
                before any link is followed. A libFuzzer run of 1.5 million inputs found nothing.
              </p>
            </div>
          </li>
        </ul>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="vx-limits">
          <li>No deletes or updates: the index only grows.</li>
          <li>
            No vector compression such as product quantization (PQ): 1M × 128 floats take 512 MB of
            the 650 MB SIFT1M index.
          </li>
          <li>
            The file format is not <code>mmap</code>-able (its sections are not aligned), so loading
            reads the whole file.
          </li>
          <li>No filtered search, such as metadata predicates applied during the graph walk.</li>
          <li>
            Every result is from one Apple M4. On x86, where hnswlib&apos;s SIMD and prefetch paths
            are active, the comparison would differ.
          </li>
        </ul>
        <p className="vx-source">
          Next, from the repository&apos;s list: an interleaved layer-0 layout (links next to
          vectors), PQ, and x86 benchmarks.
          <Source href={`${AT}/README.md#limitations-and-next-steps`}>README.md</Source>
        </p>
      </Section>
    </>
  );
}
