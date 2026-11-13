# Sources

Both files come from the Apex repository,
[github.com/MatiiiBL/apex-driverless](https://github.com/MatiiiBL/apex-driverless), at commit
`442528b6452fcca24b986a463a1169e893cb3ee9`. Every run is simulated: the car, its sensors and the
track are the repository's simulator.

## `replay.json`

One recorded run: the default car on the `mixed` reference layout, seed 1, config
`results/runs/configs/replay.json`, the same run as the repository's `docs/img/replay.gif`. The
recording is not committed upstream (750 KB), so it was produced from the commit above:

```sh
make PRESET=release build
build/release/apps/apex replay --config results/runs/configs/replay.json --out replay.json
```

The run reports 10 laps in 262.96 s with no penalty, lap 1 in 41.72 s and a best lap of
24.52 s. The file keeps, downsampled without visible loss at the page's scale:

| Key                      | From the recording                                                  | Reduction                                                   |
| ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| `x`, `y`, `yaw`, `speed` | `frames` (true pose and speed, 20 Hz on average)                    | linearly resampled every 0.1 s; cm, mrad, cm/s integers     |
| `cones`                  | `track.cones` (the true cones)                                      | cm integers; color 0 blue, 1 yellow, 2 big orange           |
| `landmarks`              | `maps` (the estimator's map, logged every second of lap 1)          | final position, and the time from which it stays in the map |
| `paths`, `raceline`      | `references` (the trajectory the controller follows, as it changes) | cm integers                                                 |
| `laps`                   | timing-line crossings in `frames`; lap times from `result.laps`     | agree to 0.02 s                                             |
| `transitions`, `summary` | `result`                                                            | rounded for display                                         |

## `results.json`

| Key           | File                          | Where                                                    |
| ------------- | ----------------------------- | -------------------------------------------------------- |
| `baseline`    | `results/runs/README.md`      | "Baseline: the full stack against the oracles" (means)   |
| `compute`     | `docs/evaluation.md`          | "Compute" (full stack, one core of an Apple M4)          |
| `noise`       | `results/runs/README.md`      | "Ablation: sensor noise"                                 |
| `controllers` | `docs/evaluation.md`          | "Tracking", the controller ablation                      |
| `mpcQp`       | `results/control/qp_bench.md` | warm-started p50 per QP, both solvers, tolerance 1e-6    |
| `racelineQp`  | `docs/planning.md`            | "QP solver", benchmark against OSQP                      |
| `tracks`      | `docs/evaluation.md`          | the per-track table (means over the stack's three seeds) |
