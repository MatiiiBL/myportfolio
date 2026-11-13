import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { bandColor } from "./mapGeometry";
import {
  SPEED_BANDS,
  lapAt,
  loadReplay,
  mappedCount,
  pathAt,
  poseAt,
  sampleIndex,
  speedTrace,
  stateAt,
  type MissionState,
} from "./replay";
import { TrackMap } from "./TrackMap";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import "./ReplayViewer.css";

const REPLAY = loadReplay();
const SPEEDS = [2, 5, 10, 20];
const STATE_NAMES: Record<MissionState, string> = {
  staged: "Staged",
  exploring: "Exploring",
  map_finalized: "Map finalized",
  racing: "Racing",
  stopping: "Stopping",
};

export function ReplayViewer() {
  const replay = REPLAY;
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const ids = useId();
  // The viewer opens on the last frame: the whole map and a full racing lap.
  const [t, setT] = useState(replay.duration);
  const [playRequested, setPlayRequested] = useState(false);
  const [speed, setSpeed] = useState(5);
  const playing = playRequested && t < replay.duration;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = Math.min(0.1, (now - last) / 1000);
      last = now;
      setT((current) => Math.min(replay.duration, current + elapsed * speed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, replay.duration]);

  const state = stateAt(replay, t);
  const pose = poseAt(replay, t);
  const mapped = mappedCount(replay, t);
  const lastLap = replay.laps[replay.laps.length - 1];
  const lap = lapAt(replay, t) ?? (lastLap && t >= lastLap.end ? lastLap : null);
  const firstLap = replay.laps[0];
  const exploring = !firstLap || t < firstLap.end;

  const exploreTrace = useMemo(() => {
    if (!exploring) return null;
    const end = sampleIndex(replay, t);
    const points: [number, number][] = [];
    for (let i = 0; i <= end; i++) points.push([replay.x[i] ?? 0, replay.y[i] ?? 0]);
    return points;
  }, [exploring, replay, t]);
  const speedRuns = useMemo(
    () => (lap && lap.lap > 1 ? speedTrace(replay, lap.start, Math.min(t, lap.end)) : []),
    [lap, replay, t],
  );

  const go = (next: number) => {
    setPlayRequested(false);
    setT(Math.max(0, Math.min(replay.duration, next)));
  };
  const togglePlay = () => {
    if (playing) {
      setPlayRequested(false);
      return;
    }
    if (t >= replay.duration) setT(0);
    setPlayRequested(true);
  };
  // A lap plays from its start; with reduced motion it shows complete, as a still frame.
  const chooseLap = (start: number, end: number) => {
    if (reduceMotion) {
      go(end - 0.05);
      return;
    }
    setT(start);
    setPlayRequested(true);
  };
  const onSliderKey = (event: KeyboardEvent<HTMLInputElement>) => {
    const steps: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 1,
      ArrowLeft: -1,
      ArrowDown: -1,
      PageUp: 10,
      PageDown: -10,
    };
    const delta = steps[event.key];
    if (delta === undefined) return;
    event.preventDefault();
    go(t + delta);
  };

  const lapText = lap ? `lap ${lap.lap} of ${replay.laps.length}` : "before the timing line";
  const status = `${STATE_NAMES[state]}, ${lapText}`;
  const label =
    `Map of the ${replay.summary.track} layout at ${t.toFixed(1)} s: ${status.toLowerCase()}, ` +
    `${pose.speed.toFixed(1)} m/s, ${mapped} of ${replay.cones.length} cones mapped.`;

  return (
    <div className="replay">
      <div className="replay__controls">
        <button
          type="button"
          className="replay__button replay__button--primary"
          onClick={togglePlay}
        >
          {playing ? "Pause" : t >= replay.duration ? "Replay" : "Play"}
        </button>
        <label className="replay__field">
          <span>Playback</span>
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s}× real time
              </option>
            ))}
          </select>
        </label>
        <dl className="replay__readout">
          <div>
            <dt>Time</dt>
            <dd>{t.toFixed(1)} s</dd>
          </div>
          <div>
            <dt>Speed</dt>
            <dd>{pose.speed.toFixed(1)} m/s</dd>
          </div>
          <div>
            <dt>Cones mapped</dt>
            <dd>
              {mapped} / {replay.cones.length}
            </dd>
          </div>
        </dl>
      </div>

      <div className="replay__scrub">
        <label htmlFor={`${ids}-time`} className="replay__status">
          {status}
        </label>
        <input
          id={`${ids}-time`}
          type="range"
          min={0}
          max={replay.duration}
          step={0.1}
          value={t}
          onChange={(e) => go(Number(e.target.value))}
          onKeyDown={onSliderKey}
          aria-valuetext={`${t.toFixed(1)} seconds: ${status}`}
        />
      </div>

      <div className="replay__laps" role="group" aria-label="Jump to a lap">
        {replay.laps.map((l) => (
          <button
            key={l.lap}
            type="button"
            className="replay__lap"
            aria-pressed={lap?.lap === l.lap}
            onClick={() => chooseLap(l.start, l.end)}
          >
            <span className="replay__lap-name">Lap {l.lap}</span>
            <span className="replay__lap-time">{l.time.toFixed(2)} s</span>
          </button>
        ))}
      </div>

      <TrackMap
        replay={replay}
        pose={pose}
        mapped={mapped}
        showRaceline={t >= replay.raceline.t}
        exploreTrace={exploreTrace}
        plannedPath={pathAt(replay, t)}
        speedRuns={speedRuns}
        label={label}
      />

      <ul className="replay__legend" aria-label="Legend">
        <li>
          <span className="key key--dot key--blue" /> blue cone (left)
        </li>
        <li>
          <span className="key key--dot key--yellow" /> yellow cone (right)
        </li>
        <li>
          <span className="key key--dot key--unmapped" /> not mapped yet
        </li>
        <li>
          <span className="key key--line key--planned" /> path being followed
        </li>
        <li>
          <span className="key key--line key--driven" /> driven on lap 1
        </li>
        <li className="replay__ramp">
          <span className="replay__ramp-keys" aria-hidden="true">
            {SPEED_BANDS.map((_, band) => (
              <span key={band} style={{ background: bandColor(band) }} />
            ))}
          </span>
          racing speed, under {SPEED_BANDS[0]?.[1]} to over {SPEED_BANDS.at(-1)?.[0]} m/s
        </li>
      </ul>
    </div>
  );
}
