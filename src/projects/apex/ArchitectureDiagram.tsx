// The simulator and the car's software as blocks and messages, in a portrait layout that stays
// legible on a phone. Coordinates are in viewBox units (400 wide).

interface BoxProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub?: string;
  /**
   * A container drawn as a frame, with its title centered at the top, between the messages
   * that cross its edge on either side.
   */
  group?: boolean;
  emphasis?: boolean;
}

function Box({ x, y, w, h, title, sub, group = false, emphasis = false }: BoxProps) {
  const className = group ? "arch-group" : emphasis ? "arch-box arch-box--em" : "arch-box";
  const tx = x + w / 2;
  const anchor = "middle";
  return (
    <g>
      <rect className={className} x={x} y={y} width={w} height={h} rx={group ? 10 : 6} />
      <text
        className="arch-title"
        x={tx}
        y={group ? y + 20 : y + (sub ? h / 2 - 3 : h / 2 + 5)}
        textAnchor={anchor}
      >
        {title}
      </text>
      {sub && (
        <text className="arch-sub" x={tx} y={group ? y + 36 : y + h / 2 + 14} textAnchor={anchor}>
          {sub}
        </text>
      )}
    </g>
  );
}

interface EdgeProps {
  points: [number, number][];
  label?: string;
  labelAt?: [number, number];
  labelAnchor?: "start" | "end";
}

/** A message path as an orthogonal polyline, with an arrowhead at its last point. */
function Edge({ points, label, labelAt, labelAnchor = "start" }: EdgeProps) {
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  if (!last || !prev) return null;
  const angle = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
  const head = [angle + 2.6, angle - 2.6]
    .map((a) => `${last[0] + 7 * Math.cos(a)},${last[1] + 7 * Math.sin(a)}`)
    .join(" ");
  return (
    <g>
      <polyline className="arch-edge" points={points.map((p) => p.join(",")).join(" ")} />
      <polygon className="arch-head" points={`${last[0]},${last[1]} ${head}`} />
      {label && labelAt && (
        <text className="arch-label" x={labelAt[0]} y={labelAt[1]} textAnchor={labelAnchor}>
          {label}
        </text>
      )}
    </g>
  );
}

export function ArchitectureDiagram() {
  return (
    <svg
      className="arch"
      viewBox="0 0 400 592"
      role="img"
      aria-labelledby="apex-arch-title apex-arch-desc"
    >
      <title id="apex-arch-title">Apex: the simulator and the car&apos;s software</title>
      <desc id="apex-arch-desc">
        The simulator generates the track, integrates the vehicle model at 1 kHz, fires the sensors
        and keeps the race officials&apos; count of laps, cones hit and excursions. The car&apos;s
        software, which never links the simulator, receives LiDAR and camera data after their
        processing latency: perception turns them into cone observations, estimation runs EKF-SLAM
        over the car&apos;s pose and the cone map (with the IMU, wheel speeds and steering angle),
        planning turns the map into a trajectory, and control sends steering and acceleration back
        to the vehicle at 50 Hz. A mission state machine runs the lap sequence.
      </desc>

      <Box x={0} y={0} w={400} h={176} title="Simulator · apex::sim" group />
      <Box x={12} y={46} w={180} h={48} title="Track" sub="random circuits" />
      <Box x={208} y={46} w={180} h={48} title="Race officials" sub="laps, cones, excursions" />
      <Box x={12} y={110} w={180} h={52} title="Sensors" sub="LiDAR, camera, IMU" />
      <Box x={208} y={110} w={180} h={52} title="Vehicle" sub="Pacejka tires, 1 kHz" />

      <Edge
        points={[
          [87, 162],
          [87, 290],
        ]}
        label="40–50 ms late"
        labelAt={[93, 210]}
      />
      <Edge
        points={[
          [313, 290],
          [313, 162],
        ]}
        label="steering, accel"
        labelAt={[307, 204]}
        labelAnchor="end"
      />
      <text className="arch-label" x={307} y={218} textAnchor="end">
        50 Hz
      </text>

      <Box
        x={0}
        y={236}
        w={400}
        h={356}
        title="The car's software"
        sub="never links the simulator"
        group
      />
      <Box x={12} y={290} w={150} h={52} title="Perception" sub="clusters, color" />
      <Box x={238} y={290} w={150} h={52} title="Control" sub="MPC, Riccati QP" emphasis />
      <Box x={12} y={392} w={150} h={52} title="Estimation" sub="EKF-SLAM, JCBB" />
      <Box x={238} y={392} w={150} h={52} title="Planning" sub="Delaunay, raceline QP" />
      <Edge
        points={[
          [87, 342],
          [87, 392],
        ]}
        label="cones"
        labelAt={[93, 372]}
      />
      <Edge
        points={[
          [162, 418],
          [238, 418],
        ]}
      />
      <text className="arch-label" x={200} y={410} textAnchor="middle">
        pose, map
      </text>
      <Edge
        points={[
          [313, 392],
          [313, 342],
        ]}
        label="trajectory"
        labelAt={[319, 372]}
      />

      <Box
        x={12}
        y={496}
        w={376}
        h={80}
        title="Mission state machine"
        sub="Staged → Exploring → MapFinalized → Racing → Stopping"
      />
    </svg>
  );
}
