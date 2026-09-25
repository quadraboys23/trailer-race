// Distance throttle toggled at runtime with T, no URL param: auto -> distance -> auto.
// The thumb is held ~3 m ahead throughout, so in distance mode the car slows,
// and back on auto it returns to top speed.
import { laneFinger, thumbAhead, r2 } from './_drive.mjs';

export default {
  milestone: 'm3',
  name: 'throttle-toggle',
  title: 'thumb ~3 m ahead throughout; T at t=3 (to distance) and t=6 (back to auto)',
  duration: 9,
  frames: { every: 0.5, from: 2.5 },
  input: [
    { t: 3, press: 't' },
    { t: 6, press: 't' },
  ],
  drive: (s) => ({ touch: [laneFinger(s.car, { look: 3 })] }),
  label: (s) => `${s.car.distanceThrottle ? 'DISTANCE' : 'auto'}  ${s.car.speed.toFixed(1)} → ${s.car.targetSpeed.toFixed(1)} m/s\nthumb ${thumbAhead(s).toFixed(1)} m ahead`,
  analyse(trace, config) {
    const at = (t) => trace.find((s) => s.t >= t - 1e-6);
    const flips = [];
    for (let i = 1; i < trace.length; i++)
      if (trace[i].car.distanceThrottle !== trace[i - 1].car.distanceThrottle)
        flips.push({ t: r2(trace[i].t), to: trace[i].car.distanceThrottle ? 'distance' : 'auto' });
    return {
      urlDistanceThrottle: config.distanceThrottle,
      flips,
      speedAt3: r2(at(2.95).car.speed),
      speedAt6: r2(at(5.95).car.speed),
      targetAt6: r2(at(5.95).car.targetSpeed),
      speedAt9: r2(trace[trace.length - 1].car.speed),
      topSpeedSetting: config.topSpeed,
    };
  },
};
