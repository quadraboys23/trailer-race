// Debug toggle: thumb distance ahead of the car sets the speed; no brake finger.
import { laneFinger, r2 } from './_drive.mjs';

const phases = [
  { until: 4, look: 6 },
  { until: 8, look: 22 },
  { until: 11, look: 3 },
];
const lookAt = (t) => (phases.find((p) => t < p.until) ?? phases[phases.length - 1]).look;

export default {
  milestone: 'm3',
  name: 'distance-throttle',
  title: 'distanceThrottle=1: thumb 6 m ahead, then 22 m, then 3 m',
  params: { distanceThrottle: true },
  duration: 11,
  frames: { every: 0.5 },
  drive: (s) => ({ touch: [laneFinger(s.car, { look: lookAt(s.t) })] }),
  label: (s) => `${s.car.speed.toFixed(1)} m/s → ${s.car.targetSpeed.toFixed(1)}`,
  analyse(trace, config) {
    const at = (t) => trace.find((s) => s.t >= t - 1e-6);
    return {
      distanceThrottle: config.distanceThrottle,
      speedAt4: r2(at(3.95).car.speed),
      speedAt8: r2(at(7.95).car.speed),
      speedAt11: r2(trace[trace.length - 1].car.speed),
      topSpeedSetting: config.topSpeed,
      everBraking: trace.some((s) => s.car.braking),
    };
  },
};
