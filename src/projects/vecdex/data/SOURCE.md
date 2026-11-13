# Sources of the vecdex page data

Repository: [github.com/MatiiiBL/HNSW_vector_search](https://github.com/MatiiiBL/HNSW_vector_search),
commit `0f5f719d6d36819883665bdb75c120234da1fc3e` ("Add GloVe-100 results"). Every file below is
from that commit. The benchmark CSVs have the columns
`lib,dataset,n,dim,M,ef_construction,build_s,memory_mb,k,ef,recall,recall_dist,qps` (plus
`threads` from the C++ harness), one row per efSearch value; `bench/results/README.md` describes
the machine and the runs.

| File                     | Source in the repository                                                                                                                                       | What was kept                                                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python-comparison.json` | `bench/results/sift1m/sift-{vecdex,faiss-hnsw,hnswlib}.csv` and `bench/results/glove100/glove-100-{vecdex,faiss-hnsw,hnswlib}.csv` (Python, batched, 1 thread) | per library: `build_s`, `memory_mb`, and for every row `ef`, `recall_dist` (as `recall`) and `qps`, unchanged                                                        |
| `cpp-harness.json`       | `bench/results/sift1m/cpp-vecdex.csv`, `cpp-hnswlib-vecdex-kernel.csv`, `cpp-hnswlib.csv` (C++ harness, 1 thread)                                              | the same fields, unchanged                                                                                                                                           |
| `threads.json`           | the `ef = 64` row of `bench/results/sift1m/cpp-vecdex.csv` (1 thread) and of `cpp-vecdex-threads-{2,4,6,8,10}.csv`                                             | `threads`, `build_s`, `qps` and `recall_dist` (as `recall`), unchanged; the page computes the speedups                                                               |
| `optimizations.json`     | `README.md`, table "Where the speed came from"                                                                                                                 | each version's build time and QPS at ef = 64, the means of two runs; the CSVs `cpp-vecdex-{m3-baseline,pooled-scratch,prefetch}.csv` hold only the first run of each |
| `reference-graph.json`   | the C++ sources, run through a harness (below)                                                                                                                 | the graph and 360 search results                                                                                                                                     |

## reference-graph.json

The graph vecdex itself builds for the explorer's 300 points (`makePoints(300, 7)` in
`../points.ts`), used by `../hnsw.test.ts` to check the TypeScript port link for link.

It was produced from that commit's sources, unmodified: `src/*.cpp` (with `kernels_neon.cpp`)
compiled with Apple clang 21 (`-std=c++20 -O2`) into a small harness that adds the points one by
one to an `HnswIndex(2, Metric::L2, {.M = 4, .ef_construction = 100, .seed = 42})`, saves it, and
runs 360 searches (60 random integer queries, each at k/ef = 1/1, 5/5, 10/10, 10/16, 10/40 and
10/300). `levels`, `links`, `entryPoint` and `maxLevel` are read back from the saved index file
as `docs/FORMAT.md` specifies it; `searches` holds each search's ids and squared distances, as
`HnswIndex::search` returned them.
