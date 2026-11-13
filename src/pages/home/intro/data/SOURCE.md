# Sources of the intro's data

Two small extracts of data the project pages already use, copied here so the home page does not
load either page's data. `../data.test.ts` checks both against their sources.

## `apex-track.json`

From `src/projects/apex/data/replay.json` (Apex, commit
`442528b6452fcca24b986a463a1169e893cb3ee9`; see `src/projects/apex/data/SOURCE.md`): one
simulated run of the default car on the `mixed` layout.

- `cones`: the run's 186 cones as they are there, `[x, y, color]` in cm (color 0 blue, 1 yellow,
  2 the big orange timing cones).
- `lap8`: the car's recorded position during lap 8, its best (24.516 s): `replay.x` and `replay.y`
  from index `ceil(start / dt)` = 1913 to `floor(end / dt)` = 2157, every second sample
  (`stride` 2, so one point per 0.2 s), in cm.

## `attention.json`

From `src/projects/minillm/data/attention-reference.json` (minillm, commit
`bb175958c4718f47f9609d5fa4c933b3a26eb255`; see `src/projects/minillm/data/SOURCE.md`): the
softmax attention weights of layer 15, query head 0, for the 13-token prompt "The capital of
France is Paris, and the capital of Italy is", row t over positions 0..t, rounded to 4 decimals.
