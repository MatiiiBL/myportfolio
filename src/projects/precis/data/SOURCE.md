# Sources of the Précis data

Repository: https://github.com/MatiiiBL/precis, commit `f2ee462`
(`f2ee462582378f2737969b05977966801116274f`).

| File                    | From                            | What was kept          |
| ----------------------- | ------------------------------- | ---------------------- |
| `bench-throughput.json` | `results/bench-throughput.json` | The whole file, as is. |
| `bench-faults.json`     | `results/bench-faults.json`     | The whole file, as is. |

Both come from Précis's offline benchmarks (`precis bench throughput`, `precis bench faults`):
the real scheduler, agents, gateway and store run against `FakeAnthropic`, which plays every
model role with deterministic stand-ins, enforces simulated rate limits and injects faults, on
virtual time. No model was called and nothing was paid; the dollar amounts are what the
simulated usage would cost at Claude Opus 5.5 prices.

## The simulation on the page

`sim/pipeline.ts` is a smaller model of the same machinery, written for the page. Its rules
and constants come from the repository: the admission limiter (`src/precis/llm/limiter.py`,
ported in `sim/limiter.ts`), the gateway's retries and backoff (`src/precis/llm/gateway.py`),
the fake server's limits, faults and latency model (`src/precis/llm/fake.py`), and the
benchmark settings (`src/precis/config.py`, `BenchConfig`; `src/precis/eval/bench.py`). Its
workload is calibrated to the files above: 2,326 counted input tokens and 201 output tokens per
request on average, and 5.02 requests per paper. Its tests compare it with
`bench-throughput.json` at every ceiling.
