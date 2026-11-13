import { Arrow, Block, BlockDiagram, Label } from "../../components/BlockDiagram";

const DESCRIPTION =
  "The simulator generates the track, integrates the vehicle model at 1 kHz, fires the sensors " +
  "and keeps the race officials' count of laps, cones hit and excursions. The car's software, " +
  "which never links the simulator, receives LiDAR and camera data after their processing " +
  "latency: perception turns them into cone observations, estimation runs EKF-SLAM over the " +
  "car's pose and the cone map (with the IMU, wheel speeds and steering angle), planning turns " +
  "the map into a trajectory, and control sends steering and acceleration back to the vehicle at " +
  "50 Hz. A mission state machine runs the lap sequence.";

/**
 * The simulator and the car's software as blocks and messages. Group titles are centered so the
 * two messages that cross each frame's top edge, at the sides, never run through them.
 */
export function ArchitectureDiagram() {
  return (
    <BlockDiagram
      height={592}
      title="Apex: the simulator and the car's software"
      description={DESCRIPTION}
    >
      <Block x={0} y={0} w={400} h={176} title="Simulator · apex::sim" group groupAlign="middle" />
      <Block x={12} y={46} w={180} h={48} title="Track" sub="random circuits" />
      <Block x={208} y={46} w={180} h={48} title="Race officials" sub="laps, cones, excursions" />
      <Block x={12} y={110} w={180} h={52} title="Sensors" sub="LiDAR, camera, IMU" />
      <Block x={208} y={110} w={180} h={52} title="Vehicle" sub="Pacejka tires, 1 kHz" />

      <Arrow
        points={[
          [87, 162],
          [87, 290],
        ]}
        label="40–50 ms late"
        labelAt={[93, 210]}
      />
      <Arrow
        points={[
          [313, 290],
          [313, 162],
        ]}
        label="steering, accel"
        labelAt={[307, 204]}
        labelAnchor="end"
      />
      <Label at={[307, 218]} text="50 Hz" anchor="end" />

      <Block
        x={0}
        y={236}
        w={400}
        h={356}
        title="The car's software"
        sub="never links the simulator"
        group
        groupAlign="middle"
      />
      <Block x={12} y={290} w={150} h={52} title="Perception" sub="clusters, color" />
      <Block x={238} y={290} w={150} h={52} title="Control" sub="MPC, Riccati QP" emphasis />
      <Block x={12} y={392} w={150} h={52} title="Estimation" sub="EKF-SLAM, JCBB" />
      <Block x={238} y={392} w={150} h={52} title="Planning" sub="Delaunay, raceline QP" />
      <Arrow
        points={[
          [87, 342],
          [87, 392],
        ]}
        label="cones"
        labelAt={[93, 372]}
      />
      <Arrow
        points={[
          [162, 418],
          [238, 418],
        ]}
        label="pose, map"
        labelAt={[200, 410]}
        labelAnchor="middle"
      />
      <Arrow
        points={[
          [313, 392],
          [313, 342],
        ]}
        label="trajectory"
        labelAt={[319, 372]}
      />

      <Block
        x={12}
        y={496}
        w={376}
        h={80}
        title="Mission state machine"
        sub="Staged → Exploring → MapFinalized → Racing → Stopping"
      />
    </BlockDiagram>
  );
}
