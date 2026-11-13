import { BarChart, LineChart } from "../../components/charts";
import { Figure } from "../../components/Figure";
import { Section } from "../../components/Section";
import { ArchitectureDiagram } from "./ArchitectureDiagram";
import replay from "./data/replay.json";
import results from "./data/results.json";
import { ReplayViewer } from "./ReplayViewer";
import "../../components/ProjectPage.css";

const REPO = "https://github.com/MatiiiBL/apex-driverless";
const COMMIT = "442528b";

function SourceLink({ file, anchor }: { file: string; anchor?: string }) {
  return (
    <a
      className="project-file"
      href={`${REPO}/blob/${COMMIT}/${file}${anchor ? `#${anchor}` : ""}`}
    >
      {file}
    </a>
  );
}

const micro = (us: number) => (us >= 1000 ? `${us / 1000} ms` : `${us} µs`);

// The Apex page body, inside ProjectLayout (docs/site.md, "Project pages").
export default function Page() {
  const { summary } = replay;
  const [stack, oracle] = results.baseline;
  return (
    <div className="project-page">
      <Section id="overview" title="Overview">
        <div className="project-prose">
          <p>
            Apex is the software of an autonomous Formula Student Driverless race car, and the
            simulator it races in, written from scratch in C++20. The car is staged on a track it
            has never seen, marked only by blue cones on the left and yellow cones on the right. On
            lap 1 it finds the cones with a LiDAR and a camera, builds a map while localizing in it
            (EKF-SLAM: an extended Kalman filter over the car&apos;s pose and every cone), and
            drives a path planned through the cones it has seen so far. Back at the line it closes
            the map, computes a minimum-curvature raceline and races nine more laps with model
            predictive control (MPC).
          </p>
          <p>
            Each part is a known algorithm. The hard part is making them work together on noisy
            data, inside a real-time budget, and finding out where each one fails. Every algorithm
            is implemented in the repository, down to the Delaunay triangulation and both
            quadratic-programming (QP) solvers, and every fast path is checked against a slow,
            obviously correct one. On eleven simulated tracks it had never seen, three seeds each,
            the car finished all 33 ten-lap runs without knocking a cone.
          </p>
        </div>
      </Section>

      <Section
        id="replay"
        title="Lap 1 maps the track, then the car races it"
        kicker="Interactive"
        navLabel="Replay"
      >
        <div className="project-prose">
          <p>
            One recorded run: the default car on the {summary.trackLength} m{" "}
            <code>{summary.track}</code> layout, seed {summary.seed}. During lap 1 the cones appear
            as the estimator adds them to its map, and the bold line ahead of the car is the path
            the planner finds through what is mapped so far, planned to come to rest before its end.
            At the line the map is frozen, the raceline is optimized, and laps 2 to 10 follow it,
            colored by speed.
          </p>
        </div>
        <Figure
          title={`Ten laps of the ${summary.track} layout`}
          subtitle="simulated · recorded with apex replay · pose every 0.1 s"
          caption={
            <>
              The car finished in {summary.totalTime} s with no penalty: lap 1 in {summary.lap1} s,
              the best racing lap in {summary.bestLap} s, up to {summary.maxSpeed} m/s. It mapped{" "}
              {summary.landmarks} landmarks for {summary.cones} cones, with{" "}
              {(summary.mapRms * 100).toFixed(1)} cm RMS position error in this run. Faint dots are
              cones it has not mapped yet; the car never sees them. Play, scrub with the slider (its
              arrow keys move 1 s, Page Up and Page Down 10 s), or pick a lap. Recorded with{" "}
              <code>apex replay</code> and <SourceLink file="results/runs/configs/replay.json" />,
              then downsampled for the page.
            </>
          }
        >
          <ReplayViewer />
        </Figure>
      </Section>

      <Section id="results" title="Results">
        <div className="project-prose">
          <p>
            From the repository&apos;s evaluation: eleven tracks the stack had never seen (eight
            generated circuits and three reference layouts), three seeds each. Every run is paired
            with the same car given perfect perception and state, the <em>oracle</em>, which
            separates what sensing costs from what planning and control cost. Everything runs in the
            simulator.
          </p>
        </div>

        {/* Wide tables scroll sideways on a phone, so the wrapper takes focus for keyboards. */}
        <div
          className="project-table-wrap"
          role="region"
          aria-label="Baseline results table"
          tabIndex={0}
        >
          <table className="project-table">
            <caption>33 ten-lap runs, the full stack against the oracle</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">Completed</th>
                <th scope="col">Lap 1</th>
                <th scope="col">Racing lap</th>
                <th scope="col">Cones per run</th>
                <th scope="col">Map error</th>
                <th scope="col">Tracking</th>
              </tr>
            </thead>
            <tbody>
              {[stack, oracle].map(
                (row) =>
                  row && (
                    <tr key={row.variant}>
                      <th scope="row">{row.variant}</th>
                      <td>{row.completed}</td>
                      <td>{row.lap1.toFixed(2)} s</td>
                      <td>{row.racingLap.toFixed(2)} s</td>
                      <td>{row.conesPerRun}</td>
                      <td>{row.mapRmsCm.toFixed(1)} cm</td>
                      <td>{row.trackingRmsCm.toFixed(1)} cm</td>
                    </tr>
                  ),
              )}
            </tbody>
          </table>
        </div>
        <p className="project-source">
          Means over the runs; the racing lap is the mean of laps 2 to 10, map error is the RMS
          distance from each landmark to its cone after lap 1 (1.4 cm at the median run), tracking
          is the RMS lateral error from the raceline. Perfect perception and state make a racing lap
          0.04 s faster. Source:{" "}
          <SourceLink
            file="results/runs/README.md"
            anchor="baseline-the-full-stack-against-the-oracles"
          />
          .
        </p>

        <BarChart
          title="Every module inside its real-time budget"
          subtitle="p99 per call · one core of an Apple M4 · log scale"
          categories={results.compute.map((c) => c.work)}
          categoryLabel="Work"
          series={[
            { id: "p99", label: "p99", values: results.compute.map((c) => c.p99Us) },
            {
              id: "budget",
              label: "Budget",
              values: results.compute.map((c) => c.budgetUs),
              color: "muted",
            },
          ]}
          value={{ type: "log", label: "time per call", format: micro, tickFormat: micro }}
          caption={
            <>
              The full stack, three laps on each reference layout with nothing else running. The MPC
              is the tightest, at {results.compute[0]?.p99Us} µs against 2 ms; the whole closed
              loop, simulator included, runs 43.6 times faster than real time. Source:{" "}
              <SourceLink file="docs/evaluation.md" anchor="compute" />.
            </>
          }
        />

        <LineChart
          title="Map and localization error as sensor noise grows"
          subtitle="12 runs per level · RMS, mean over runs"
          x={{ type: "linear", label: "sensor noise (× default)", ticks: [0, 0.5, 1, 2, 4] }}
          y={{ type: "linear", label: "error (cm)", format: (v) => `${v.toFixed(1)} cm` }}
          series={[
            {
              id: "map",
              label: "Map after lap 1",
              points: results.noise.map((n) => ({ x: n.scale, y: n.mapRmsCm })),
            },
            {
              id: "localization",
              label: "Localization while racing",
              points: results.noise.map((n) => ({
                x: n.scale,
                y: n.localizationRacingCm,
                note: `association recall ${(n.recall * 100).toFixed(1)}%`,
              })),
            },
          ]}
          endLabels
          caption={
            <>
              Every run finishes with no penalty from noiseless sensors to four times the default
              noise, with racing laps within 0.12% of the default&apos;s. The errors grow roughly in
              proportion; at four times the noise, association recall falls to 81%. Source:{" "}
              <SourceLink file="results/runs/README.md" anchor="ablation-sensor-noise" />.
            </>
          }
        />

        <LineChart
          title="The MPC's QP solver against OSQP"
          subtitle="warm-started · p50 per QP · tolerance 1e-6 · mixed layout"
          x={{ type: "linear", label: "horizon (stages of 50 ms)", ticks: [20, 30, 40, 50, 60] }}
          y={{ type: "linear", label: "time per QP (µs)", format: (v) => `${v} µs` }}
          series={[
            {
              id: "ours",
              label: "Riccati interior point",
              points: results.mpcQp.map((q) => ({ x: q.horizon, y: q.oursUs })),
            },
            {
              id: "osqp",
              label: "OSQP",
              color: "muted",
              points: results.mpcQp.map((q) => ({ x: q.horizon, y: q.osqpUs })),
            },
          ]}
          endLabels
          caption={
            <>
              Both solve every QP of 1,000 MPC calls. The structure-exploiting solver is 4.7 to 5.2
              times faster warm-started, and its cost grows linearly with the horizon. The
              raceline&apos;s dense QP solver beats OSQP too: {results.racelineQp.oursMs} ms against{" "}
              {results.racelineQp.osqpMs} ms at 1e-9. Source:{" "}
              <SourceLink file="results/control/qp_bench.md" />.
            </>
          }
        />

        <div
          className="project-table-wrap"
          role="region"
          aria-label="Controller comparison table"
          tabIndex={0}
        >
          <table className="project-table">
            <caption>The path-tracking controller, 12 runs each</caption>
            <thead>
              <tr>
                <td />
                <th scope="col">Completed</th>
                <th scope="col">Tracking, racing</th>
                <th scope="col">Cones per run</th>
                <th scope="col">Racing lap vs MPC</th>
              </tr>
            </thead>
            <tbody>
              {results.controllers.map((row) => (
                <tr key={row.controller}>
                  <th scope="row">{row.controller}</th>
                  <td>{row.completed}</td>
                  <td>{row.trackingRmsCm.toFixed(1)} cm</td>
                  <td>{row.conesPerRun}</td>
                  <td>{row.racingLapVsMpc || "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="project-source">
          Pure pursuit cuts corners: in the two runs traced, its cones fell with the car&apos;s
          center 0.78 to 1.07 m off the centerline. Source:{" "}
          <SourceLink file="docs/evaluation.md" anchor="tracking" />.
        </p>
      </Section>

      <Section id="how" title="How it works">
        <div className="project-how">
          <Figure
            title="Two programs in one loop"
            subtitle="lockstep · 1 ms physics · 20 ms control"
            caption={
              <>
                The runner steps the simulator and the car together and delivers the LiDAR and
                camera results after their processing latency. Source:{" "}
                <SourceLink file="docs/design.md" anchor="2-architecture" />.
              </>
            }
          >
            <ArchitectureDiagram />
          </Figure>
          <div className="project-decisions">
            <article>
              <h3>The car never links the simulator</h3>
              <p>
                Perception, estimation, planning and control link only the core library; CMake
                enforces it. Ground truth reaches the car only through <code>truth_id</code> fields
                used for scoring, and a test proves no decision reads them: relabeling every truth
                id gives bit-identical commands. Runs are deterministic, one seeded random stream
                per consumer and one thread per run, so any failure is reproduced with one line of
                JSON.
              </p>
            </article>
            <article>
              <h3>Every fast path has a slow oracle</h3>
              <p>
                The LiDAR ray caster casts 57,664 rays per scan and is bit-identical to a
                brute-force every-ray-every-cone reference, 42 times slower. Both QP solvers are
                checked against OSQP, the vehicle model against analytic cornering limits, the
                online SLAM map against batch least squares over the whole run, and the Delaunay
                triangulation against the empty-circumcircle property.
              </p>
            </article>
            <article>
              <h3>Grip is per axle, not per car</h3>
              <p>
                The first speed profile used one friction ellipse for the whole car, and the car
                slid wide at every corner entry. Under hard braking the load moves to the front
                while the brakes keep a 60/40 split: at −18.5 m/s² the rear carries 32% of the load
                and 40% of the braking. The planner now checks each axle&apos;s ellipse, and the MPC
                bounds its acceleration by what each axle has left after the corner&apos;s lateral
                force.
              </p>
            </article>
          </div>
        </div>
      </Section>

      <Section id="limits" title="Limits">
        <ul className="project-limits">
          <li>
            <strong>The world is simulated, and simple.</strong> The ground is flat, LiDAR scans are
            instantaneous, knocked cones stay put, sensor noise is Gaussian, and the tires have no
            temperature or wear. The errors measured here are those of this world, not of a real
            track.
          </li>
          <li>
            <strong>The grip is assumed known.</strong> The planner races at 70% of the tires&apos;
            nominal grip and does not adapt. On a track with 30% less grip than nominal, 6 of 12
            runs fail (three leave the track, three stall) and the others knock 20 to 35 cones.
          </li>
          <li>
            <strong>33 runs show typical behavior, not rare failures.</strong> About one MPC command
            in 100,000 reaches the QP solver&apos;s iteration limit and falls back to a safe
            command, so far without a penalty.
          </li>
          <li>
            <strong>The localization filter is often overconfident while racing:</strong> its pose
            NEES (normalized estimation error squared) reaches 6 against an ideal of 3, for a reason
            not yet traced.
          </li>
          <li>
            <strong>Compute times come from one machine</strong>, an Apple M4, measured with nothing
            else running.
          </li>
        </ul>
        <p className="project-source">
          Source: <SourceLink file="README.md" anchor="limitations" />.
        </p>
      </Section>
    </div>
  );
}
