# Source of the HNSW port and its reference graph

`hnsw.ts` and `mt19937.ts` port vecdex's `src/hnsw.cpp` and the `std::mt19937_64` it draws levels
from: [github.com/MatiiiBL/HNSW_vector_search](https://github.com/MatiiiBL/HNSW_vector_search),
commit `0f5f719d6d36819883665bdb75c120234da1fc3e` ("Add GloVe-100 results").

## reference-graph.json

The graph vecdex itself builds for `makePoints(300, 7)` (`points.ts`), used by `hnsw.test.ts` to
check the port link for link.

It was produced from that commit's sources, unmodified: `src/*.cpp` (with `kernels_neon.cpp`)
compiled with Apple clang 21 (`-std=c++20 -O2`) into a small harness that adds the points one by
one to an `HnswIndex(2, Metric::L2, {.M = 4, .ef_construction = 100, .seed = 42})`, saves it, and
runs 360 searches (60 random integer queries, each at k/ef = 1/1, 5/5, 10/10, 10/16, 10/40 and
10/300). `levels`, `links`, `entryPoint` and `maxLevel` are read back from the saved index file
as vecdex's `docs/FORMAT.md` specifies it; `searches` holds each search's ids and squared
distances, as `HnswIndex::search` returned them. `pointSeed` is the seed of the point set.

The C++ draws levels with `std::log`, the port with `../detmath.ts`'s `log`, so that the
prerender and every browser build the same graph. The two agree on every level draw of this
graph: the test compares the levels as well as the links.
