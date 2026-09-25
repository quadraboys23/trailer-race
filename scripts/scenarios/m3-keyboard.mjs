// Keyboard path: left arrow steers, space brakes. No touches at all.
import { deg, r2 } from './_drive.mjs';

export default {
  milestone: 'm3',
  name: 'keyboard',
  title: 'ArrowLeft held 1.5–2.1s, ArrowRight 2.6–3.2s, Space 3.5–4.5s',
  duration: 5,
  frames: { every: 0.25, from: 1.25, to: 5 },
  input: [
    { t: 1.5, keyDown: 'ArrowLeft' },
    { t: 2.1, keyUp: 'ArrowLeft' },
    { t: 2.6, keyDown: 'ArrowRight' },
    { t: 3.2, keyUp: 'ArrowRight' },
    { t: 3.5, keyDown: ' ' },
    { t: 4.5, keyUp: ' ' },
  ],
  label: (s) => `${s.car.speed.toFixed(1)} m/s  yaw ${deg(s.car.angvel).toFixed(0)}°/s${s.car.braking ? '  BRAKE' : ''}`,
  analyse(trace, config) {
    const win = (a, b) => trace.filter((s) => s.t > a + 0.05 && s.t <= b);
    const at = (t) => trace.find((s) => s.t >= t - 1e-6);
    return {
      yawRateDuringLeftDegS: r2(deg(Math.min(...win(1.5, 2.1).map((s) => s.car.angvel))), 0),
      yawRateDuringRightDegS: r2(deg(Math.max(...win(2.6, 3.2).map((s) => s.car.angvel))), 0),
      steerRateSettingDegS: r2(deg(config.steerRate), 0),
      brakingDuringSpace: win(3.5, 4.5).every((s) => s.car.braking),
      speedAtSpace: r2(at(3.5).car.speed),
      speedAtRelease: r2(at(4.5).car.speed),
    };
  },
};
