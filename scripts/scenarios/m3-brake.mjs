// Second finger held for 1.5 s while the steering thumb keeps driving.
import { laneFinger, BRAKE_FINGER, r2 } from './_drive.mjs';

const ON = 4;
const OFF = 5.0;

export default {
  milestone: 'm3',
  name: 'brake',
  title: `second finger held ${ON}–${OFF}s (bright tail lights = braking)`,
  duration: 7.5,
  frames: { every: 0.25, from: 3.5, to: 7.5 },
  drive: (s) => ({
    touch: s.t >= ON - 1e-6 && s.t < OFF - 1e-6 ? [laneFinger(s.car), BRAKE_FINGER] : [laneFinger(s.car)],
  }),
  label: (s) => `${s.car.speed.toFixed(1)} m/s  brake ${s.car.braking ? 'ON' : '-'}`,
  analyse(trace, config) {
    const at = (t) => trace.find((s) => s.t >= t - 1e-6);
    const a = at(ON);
    const b = at(OFF);
    return {
      speedAtBrakeOn: r2(a.car.speed),
      speedAtBrakeOff: r2(b.car.speed),
      speedDrop: r2(a.car.speed - b.car.speed),
      decelMs2: r2((a.car.speed - b.car.speed) / (OFF - ON)),
      framesBrakingFlag: trace.filter((s) => s.car.braking).length,
      // The flag is read the frame after the finger changes, hence the 1-frame slack.
      brakingOnlyWhileHeld: trace.every((s) => s.car.braking === (s.t > ON && s.t <= OFF + 1 / 60) || Math.abs(s.t - ON) < 0.02 || Math.abs(s.t - OFF) < 0.02),
      speedAt7_5: r2(at(7.5)?.car.speed ?? trace[trace.length - 1].car.speed),
      framesOffAsphalt: trace.filter((s) => !s.car.onAsphalt).length,
      accelSetting: config.accel,
    };
  },
};
