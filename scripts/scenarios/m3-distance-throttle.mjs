// Debug toggle: thumb distance ahead of the car sets the speed; no brake finger.
import { laneFinger, thumbAhead as ahead, r2 } from './_drive.mjs';

// Look-ahead along the lane; the harness also clamps the finger to the screen,
// so the label logs the real distance ahead of the car.
const phases = [
  { until: 4, look: 3 },
  { until: 8, look: 13 },
  { until: 11, look: 1.5 },
];
const lookAt = (t) => (phases.find((p) => t < p.until) ?? phases[phases.length - 1]).look;

export default {
  milestone: 'm3',
  name: 'distance-throttle',
  title: 'distanceThrottle=1: thumb ~3 m ahead, then ~13 m (full speed at 12), then ~1.5 m',
  params: { distanceThrottle: true },
  duration: 11,
  frames: { every: 0.5 },
  drive: (s) => ({ touch: [laneFinger(s.car, { look: lookAt(s.t) })] }),
  label: (s) => `${s.car.speed.toFixed(1)} m/s → ${s.car.targetSpeed.toFixed(1)}\nthumb ${ahead(s).toFixed(1)} m ahead`,
  analyse(trace, config) {
    const at = (t) => trace.find((s) => s.t >= t - 1e-6);
    return {
      distanceThrottle: config.distanceThrottle,
      thumbAheadAt4: r2(ahead(at(3.95))),
      thumbAheadAt8: r2(ahead(at(7.95))),
      speedAt4: r2(at(3.95).car.speed),
      speedAt8: r2(at(7.95).car.speed),
      speedAt11: r2(trace[trace.length - 1].car.speed),
      topSpeedSetting: config.topSpeed,
      everBraking: trace.some((s) => s.car.braking),
    };
  },
};
