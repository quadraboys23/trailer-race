// Three clean laps driven purely by a synthetic steering finger, default config.
import { laneFinger, LANE_OUTSIDE, r2 } from './_drive.mjs';

export default {
  milestone: 'm3',
  name: 'laps',
  title: 'scripted thumb drives 3 laps in the outside lane, defaults',
  duration: 55,
  frames: { every: 2.5 },
  drive: (s) => ({ touch: [laneFinger(s.car)] }),
  label: (s) => `lap ${s.car.laps.toFixed(2)}  ${s.car.speed.toFixed(1)} m/s\noffset ${s.car.trackOffset.toFixed(1)} m`,
  analyse(trace, config) {
    const done = trace.find((s) => s.car.laps >= 3);
    const upTo = done ? trace.slice(0, trace.indexOf(done) + 1) : trace;
    const offTrack = upTo.filter((s) => !s.car.onAsphalt);
    const maxSpeed = Math.max(...trace.map((s) => s.car.speed));
    return {
      lapsCompleted: r2(trace[trace.length - 1].car.laps),
      threeLapsAtT: done ? r2(done.t) : null,
      framesOffAsphaltBeforeLap3: offTrack.length,
      maxAbsTrackOffsetM: r2(Math.max(...upTo.map((s) => Math.abs(s.car.trackOffset)))),
      laneTargetM: LANE_OUTSIDE,
      rigContactFrames: upTo[upTo.length - 1].car.contactFrames,
      framesSliding: upTo.filter((s) => s.car.sliding).length,
      maxSpeed: r2(maxSpeed),
      topSpeedSetting: config.topSpeed,
      trailerSpeed: config.trailerSpeed,
      topSpeedOverTrailer: r2(config.topSpeed / config.trailerSpeed),
      clean: !!done && offTrack.length === 0 && upTo[upTo.length - 1].car.contactFrames === 0,
    };
  },
};
