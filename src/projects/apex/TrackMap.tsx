import { memo } from "react";
import { bandColor, dots, polyline, viewBox } from "./mapGeometry";
import type { ConeColor, Pose, Replay, TraceRun } from "./replay";

const CONE_CLASS: Record<ConeColor, string> = {
  0: "map-cone map-cone--blue",
  1: "map-cone map-cone--yellow",
  2: "map-cone map-cone--orange",
};

/** The parts that never change during playback: the true cones and the timing line. */
const StaticLayer = memo(function StaticLayer({ replay }: { replay: Replay }) {
  const [[ax, ay], [bx, by]] = replay.timingLine;
  return (
    <g>
      <path className="map-unmapped" d={dots(replay.cones)} />
      <line className="map-timing" x1={ax} y1={-ay} x2={bx} y2={-by} />
    </g>
  );
});

const Raceline = memo(function Raceline({ points }: { points: [number, number][] }) {
  return <polygon className="map-raceline" points={polyline(points)} />;
});

/** The landmarks mapped so far, one path per color. */
const Landmarks = memo(function Landmarks({ replay, count }: { replay: Replay; count: number }) {
  const mapped = replay.landmarks.slice(0, count);
  return (
    <g>
      {([0, 1, 2] as const).map((color) => (
        <path
          key={color}
          className={CONE_CLASS[color]}
          d={dots(mapped.filter((lm) => lm.color === color))}
        />
      ))}
    </g>
  );
});

interface TrackMapProps {
  replay: Replay;
  pose: Pose;
  mapped: number;
  showRaceline: boolean;
  /** The car's path on lap 1 so far, while it explores. */
  exploreTrace: [number, number][] | null;
  /** The path the controller is following, while it is not the raceline. */
  plannedPath: [number, number][] | null;
  /** The current racing lap so far, by speed band. */
  speedRuns: TraceRun[];
  label: string;
}

/** The track as the car knows it at one instant of the run. */
export function TrackMap(props: TrackMapProps) {
  const { replay, pose, mapped, showRaceline, exploreTrace, plannedPath, speedRuns, label } = props;
  const heading = 5;
  return (
    <svg className="track-map" viewBox={viewBox(replay)} role="img" aria-label={label}>
      <StaticLayer replay={replay} />
      {showRaceline && <Raceline points={replay.raceline.points} />}
      {exploreTrace && <polyline className="map-driven" points={polyline(exploreTrace)} />}
      {speedRuns.map((run, i) => (
        <polyline
          key={i}
          className="map-speed"
          points={polyline(run.points)}
          style={{ stroke: bandColor(run.band) }}
        />
      ))}
      {plannedPath && <polyline className="map-planned" points={polyline(plannedPath)} />}
      <Landmarks replay={replay} count={mapped} />
      <line
        className="map-heading"
        x1={pose.x}
        y1={-pose.y}
        x2={pose.x + heading * Math.cos(pose.yaw)}
        y2={-(pose.y + heading * Math.sin(pose.yaw))}
      />
      <path className="map-car-ring" d={`M${pose.x} ${-pose.y}h0`} />
      <path className="map-car" d={`M${pose.x} ${-pose.y}h0`} />
    </svg>
  );
}
