import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Figure } from "../../components/Figure";
import bench from "./data/bench-throughput.json";
import { LiveChart } from "./LiveChart";
import { PaperGrid } from "./PaperGrid";
import {
  BENCH_FAULTS,
  BENCH_LIMITS,
  NO_FAULTS,
  papersPerMinute,
  simulate,
  type Sample,
  type Scenario,
} from "./sim/pipeline";
import { STATE_TOKENS } from "./stateTokens";
import { SourceLink } from "../../components/SourceLink";
import { SOURCE } from "./source";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "./PipelineSim.css";

type Preset = "limits" | "overload" | "faults";

const PRESETS: Record<Preset, { label: string; describe: (ceiling: number) => string }> = {
  limits: {
    label: "Rate limits",
    describe: (c) =>
      `2,000 papers · server limits: 4,000 requests, 2M input and 400K output tokens per minute · ceiling ${c}`,
  },
  overload: {
    label: "Overloaded server",
    describe: () => "600 papers · the server answers 529 above 24 requests in flight · ceiling 64",
  },
  faults: {
    label: "Injected faults",
    describe: () =>
      "500 papers · rate limits as above · 4% 429, 2% 529, 2% 500, 1% timeouts · ceiling 32",
  },
};

const CEILINGS = [16, 32, 64, 128, 256];
// A run plays in about this many seconds of wall time, whatever its simulated length.
const PLAY_SECONDS = 16;
const STATE_LABELS = ["Fetched", "Reader", "Critic", "Reviser", "Done, to topics", "Failed"];

function scenarioFor(preset: Preset, ceiling: number, killAt: number | null): Scenario {
  const kill = killAt === null ? {} : { killAt };
  if (preset === "overload") {
    return {
      papers: 600,
      ceiling: 64,
      limits: null,
      overloadAbove: 24,
      faults: NO_FAULTS,
      seed: 2,
      ...kill,
    };
  }
  if (preset === "faults") {
    return {
      papers: 500,
      ceiling: 32,
      limits: BENCH_LIMITS,
      overloadAbove: null,
      faults: BENCH_FAULTS,
      seed: 3,
      ...kill,
    };
  }
  return {
    papers: 2000,
    ceiling,
    limits: BENCH_LIMITS,
    overloadAbove: null,
    faults: NO_FAULTS,
    seed: 1,
    ...kill,
  };
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const n = (x: number) => x.toLocaleString("en-US");

export function PipelineSim() {
  const [preset, setPreset] = useState<Preset>("limits");
  const [ceiling, setCeiling] = useState(128);
  const [killAt, setKillAt] = useState<number | null>(null);
  // Simulated seconds shown; null until the visitor or the playback picks a time.
  const [t, setT] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [seen, setSeen] = useState(false);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const id = useId();
  const root = useRef<HTMLDivElement>(null);

  const run = useMemo(
    () => simulate(scenarioFor(preset, ceiling, killAt)),
    [preset, ceiling, killAt],
  );
  const end = run.samples.length - 1;
  const rates = useMemo(() => papersPerMinute(run.samples), [run]);
  // The benchmark's measure: papers finished over the minutes elapsed.
  const average = useMemo(() => run.samples.map((s) => (s.t > 0 ? (s.done * 60) / s.t : 0)), [run]);
  const speed = Math.max(30, Math.round(end / PLAY_SECONDS));
  // With reduced motion the run is shown complete; the slider still moves through it.
  const now = Math.min(t ?? (reduced ? end : 0), end);
  const sample = run.samples[Math.floor(now)] as Sample;
  const running = playing && !reduced && now < end;

  // Start playing the first time the figure scrolls into view.
  useEffect(() => {
    const el = root.current;
    if (!el || seen || reduced || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setSeen(true);
          setPlaying(true);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [seen, reduced]);

  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let previous: number | null = null;
    let pending = 0;
    const tick = (stamp: number) => {
      if (previous !== null) pending += ((stamp - previous) / 1000) * speed;
      previous = stamp;
      // About twenty updates a second are enough for the eye and keep the page light.
      if (pending >= speed / 20) {
        const step = pending;
        pending = 0;
        setT((x) => Math.min(end, (x ?? 0) + step));
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, speed, end]);

  const restart = (next: { preset?: Preset; ceiling?: number }) => {
    if (next.preset) setPreset(next.preset);
    if (next.ceiling) setCeiling(next.ceiling);
    setKillAt(null);
    setT(null);
    setPlaying(!reduced);
  };

  const kill = () => {
    setKillAt(Math.max(1, Math.floor(now)));
    setT(Math.floor(now));
    setPlaying(!reduced);
  };

  const killed = run.kill;
  const benchPoint = bench.points.find((p) => p.concurrency === ceiling);
  const finished = now >= end;
  const buckets: [string, number, string][] = [
    ["requests", sample.buckets[0], "request"],
    ["input tokens", sample.buckets[1], "input-token"],
    ["output tokens", sample.buckets[2], "output-token"],
  ];
  // A bucket close to empty while requests hold slots without being sent is the binding limit.
  const waiting = sample.holding > sample.sending;
  const binding = waiting ? buckets.find(([, fill]) => fill >= 0 && fill < 0.1)?.[2] : undefined;

  return (
    <Figure
      title="Two thousand papers through one gateway"
      subtitle={PRESETS[preset].describe(ceiling)}
      caption={
        <>
          A small simulation of Précis&apos;s scheduler, gateway and fake API, in simulated time:
          each paper is read, verified and, when a claim fails, revised, one request per agent turn.
          The gateway admits requests under the AIMD window and the token buckets it learns from the
          response headers, and retries 429, 529, 5xx and timeouts as Précis does. Kill the run and
          it resumes from what the store kept: finished stages are skipped, finished turns are
          replayed from the cache, and only requests in flight at the kill are sent again. The
          finished papers then go to the topic stage, which runs once on the whole corpus. Rules and
          constants come from the repository; the workload is calibrated to{" "}
          <SourceLink {...SOURCE} file="results/bench-throughput.md" />, and the tests check the
          simulation against it at every ceiling.
        </>
      }
    >
      <div className="sim" ref={root}>
        <div className="sim-controls">
          <fieldset className="sim-knob">
            <legend className="sim-knob-name">server</legend>
            <div className="sim-segmented">
              {(Object.keys(PRESETS) as Preset[]).map((p) => (
                <label key={p} className="sim-segment">
                  <input
                    type="radio"
                    name={`${id}preset`}
                    checked={preset === p}
                    onChange={() => restart({ preset: p })}
                  />
                  <span>{PRESETS[p].label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {preset === "limits" && (
            <fieldset className="sim-knob">
              <legend className="sim-knob-name">concurrency ceiling</legend>
              <div className="sim-segmented">
                {CEILINGS.map((c) => (
                  <label key={c} className="sim-segment">
                    <input
                      type="radio"
                      name={`${id}ceiling`}
                      checked={ceiling === c}
                      onChange={() => restart({ ceiling: c })}
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}
        </div>

        <div className="sim-transport">
          {!reduced && (
            <button
              type="button"
              className="sim-button"
              onClick={() => {
                if (running) {
                  setPlaying(false);
                  return;
                }
                if (now >= end) setT(0);
                setPlaying(true);
              }}
            >
              {running ? "Pause" : "Play"}
            </button>
          )}
          <button
            type="button"
            className="sim-button sim-kill"
            onClick={kill}
            disabled={killed !== null || finished || now < 1}
            aria-label="Kill the run with SIGKILL, then resume it"
          >
            SIGKILL
          </button>
          <input
            type="range"
            className="sim-range"
            min={0}
            max={end}
            step={1}
            value={Math.floor(now)}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value));
            }}
            aria-label="Simulated time"
            aria-valuetext={`${clock(now)} of ${clock(end)} simulated`}
          />
          <span className="sim-clock">
            {clock(now)} / {clock(end)}
            <span className="sim-speed"> · {speed}×</span>
          </span>
        </div>

        <ol className="stages" aria-label="Papers by stage">
          {[0, 1, 2, 3, 4].map((s) => (
            <li key={s}>
              <span
                className="stage-key"
                style={{ background: `var(${STATE_TOKENS[s]})` }}
                aria-hidden="true"
              />
              <span className="stage-name">{STATE_LABELS[s]}</span>
              <span className="stage-count">{n(sample.states[s] ?? 0)}</span>
            </li>
          ))}
          {(sample.states[5] ?? 0) > 0 && (
            <li>
              <span className="stage-name">Failed</span>
              <span className="stage-count">{n(sample.states[5] ?? 0)}</span>
            </li>
          )}
        </ol>

        <div className="sim-main">
          <div>
            <PaperGrid papers={run.scenario.papers} transitions={run.transitions} t={now} />
            <dl className="gateway">
              <div>
                <dt>Window</dt>
                <dd>{sample.limit}</dd>
              </div>
              <div>
                <dt>Holding a slot</dt>
                <dd>{sample.holding}</dd>
              </div>
              <div>
                <dt>At the server</dt>
                <dd>{sample.sending}</dd>
              </div>
              <div>
                <dt>Answered</dt>
                <dd>{n(sample.paid)}</dd>
              </div>
              <div>
                <dt>429 / 529</dt>
                <dd>
                  {n(sample.rateLimited)} / {n(sample.overloaded)}
                </dd>
              </div>
              <div>
                <dt>Retries</dt>
                <dd>{n(sample.retries)}</dd>
              </div>
            </dl>
            <div className="buckets" aria-label="Client token buckets">
              {buckets.map(([label, fill]) => (
                <div key={label} className="bucket">
                  <span className="bucket-name">{label}</span>
                  <span className="bucket-track" aria-hidden="true">
                    <span
                      className="bucket-fill"
                      style={{ width: `${Math.max(0, fill) * 100}%` }}
                    />
                  </span>
                  <span className="bucket-value">
                    {fill < 0 ? "learning" : `${Math.round(fill * 100)}%`}
                  </span>
                </div>
              ))}
              <p className="bucket-note">
                What each bucket lets through now, of a 10-second burst.
                {binding && ` Requests are waiting for the ${binding} bucket: it sets the pace.`}
              </p>
            </div>
          </div>
          <div className="sim-charts">
            <LiveChart
              title="Concurrency"
              yLabel="requests"
              upTo={now}
              duration={end}
              yMax={preset === "limits" ? Math.max(ceiling, 16) * 1.1 : 40}
              series={[
                { label: "AIMD window", color: 1, values: run.samples.map((s) => s.limit) },
                { label: "holding a slot", color: 2, values: run.samples.map((s) => s.holding) },
              ]}
              references={preset === "overload" ? [{ value: 24, label: "server capacity" }] : []}
              marker={killed ? { at: killed.at, label: "SIGKILL" } : null}
            />
            <LiveChart
              title="Papers finished per minute"
              yLabel="papers/min"
              upTo={now}
              duration={end}
              yMax={preset === "limits" ? 220 : preset === "overload" ? 60 : 100}
              series={[
                { label: "since the start", color: 1, values: average },
                { label: "over the last minute", color: "muted", values: rates },
              ]}
              references={
                preset === "limits" && benchPoint
                  ? [
                      {
                        value: benchPoint.papers_per_minute,
                        label: `benchmark ${benchPoint.papers_per_minute.toFixed(1)}`,
                      },
                    ]
                  : []
              }
              marker={killed ? { at: killed.at, label: "SIGKILL" } : null}
            />
          </div>
        </div>

        {killed && now >= killed.at && (
          <div className="kill-report" role="status">
            <p>
              Killed at {clock(killed.at)} with {n(killed.finishedAtKill)} papers finished,{" "}
              {killed.stagesRunning} stages running and {killed.inFlight} requests at the server.
              The new process starts {clock(killed.resumedAt - killed.at)} later with an empty
              window, which slow start grows again.
            </p>
            {now >= killed.resumedAt && (
              <p>
                Since the restart: {n(sample.cached)} finished turns replayed from the cache at no
                cost, {sample.resent} of the {killed.inFlight} requests in flight at the kill sent
                again.
                {finished &&
                  ` All ${n(run.totals.papersDone)} papers finished; requests paid for twice: ${run.totals.paidTwice}.`}
              </p>
            )}
          </div>
        )}
        <p className="visually-hidden" aria-live={running ? "off" : "polite"}>
          At {clock(now)} simulated: {n(sample.done)} of {n(run.scenario.papers)} papers done,
          window {sample.limit}, {sample.holding} requests holding a slot, {n(sample.paid)}{" "}
          answered, {sample.rateLimited} rate-limited.
        </p>
      </div>
    </Figure>
  );
}
