// Steering lag: at t=3 the thumb jumps from straight ahead to 45deg left and is
// held there (relative to the car, as a still thumb is on a following camera).
import { laneFinger, relativeFinger, deg, r2 } from './_drive.mjs';

const JUMP = 3;
const BEARING = -Math.PI / 4; // left (screen y is down, so negative is anticlockwise)

export default {
  milestone: 'm3',
  name: 'steer-response',
  title: 'thumb jumps 45° left at t=3.00: frames every 1/15 s',
  duration: 4.2,
  driveEvery: 1,
  frames: { every: 1 / 15, from: 2.8, to: 4.2 },
  drive: (s) => ({
    touch: [s.t < JUMP - 1e-6 ? laneFinger(s.car) : relativeFinger(s.car, { bearing: BEARING, dist: 10 })],
  }),
  label: (s) => `yaw rate ${deg(s.car.angvel).toFixed(0)}°/s\nheading ${deg(s.car.angle).toFixed(0)}°`,
  analyse(trace, config) {
    // The driver sees this state, moves the thumb, and the next frame is the
    // first that can respond. So "1 frame" is the fastest possible.
    const i0 = trace.findIndex((s) => s.t >= JUMP - 1e-6);
    const before = trace[i0];
    const firstTurn = trace.slice(i0).find((s) => s.car.angvel < -0.05);
    const full = trace.slice(i0).find((s) => s.car.angvel <= -config.steerRate * 0.95);
    const h0 = before.car.angle;
    const turned20 = trace.slice(i0).find((s) => Math.abs(s.car.angle - h0) >= Math.PI / 9);
    const f = (s) => (s ? Math.round((s.t - before.t) * 60) : null);
    return {
      thumbMovedAfterT: r2(before.t),
      steerRateSetting: config.steerRate,
      framesToFirstYaw: f(firstTurn),
      framesToFullYawRate: f(full),
      msToTurn20deg: turned20 ? Math.round((turned20.t - before.t) * 1000) : null,
      yawRateDegS_first6Frames: trace.slice(i0 + 1, i0 + 7).map((s) => r2(deg(s.car.angvel), 0)),
      speedAtInput: r2(before.car.speed),
    };
  },
};
