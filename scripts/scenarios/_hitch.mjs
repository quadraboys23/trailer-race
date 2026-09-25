// Shared M2 hitch scenario + analysis. Truck starts at s=0 on the bottom
// straight; the first corner (rightArc) starts at s = TRACK.straight.
import { TRACK, SEG } from '../../src/track.js';

const SETTLE_BAND = 1; // deg: "settled" = within this of the steady corner angle

export function hitchScenario({ name, hitchLoose, camera = 'overview' }) {
  return {
    milestone: 'm2',
    name,
    title: `hitchLoose ${hitchLoose ?? 'default'}, ${camera} camera, first corner entry`,
    params: hitchLoose === undefined ? {} : { hitchLoose },
    duration: 12,
    frames: { every: 0.5, from: 4, to: 12 },
    input: camera === 'overview' ? [{ t: 0, click: '#overview' }] : [],
    label: (s) => `${s.segment} yaw ${s.hitchYawDeg.toFixed(1)}°`,
    analyse: analyseCornerEntry,
  };
}

/** Swing past the steady corner angle, and time to settle, for the first corner. */
export function analyseCornerEntry(trace, config) {
  const entryT = TRACK.straight / config.trailerSpeed;
  const exitT = entryT + SEG.rightArc / config.trailerSpeed;
  const arc = trace.filter((s) => s.t >= entryT && s.t < exitT);
  const tail = arc.filter((s) => s.t >= exitT - 1.5);
  const steady = tail.reduce((a, s) => a + s.hitchYawDeg, 0) / tail.length;
  // On entry the trailer first yaws one way (it lags the truck into the turn).
  // The swing is how far it goes PAST the angle it finally settles at, in that
  // direction. A rigid trailer rises straight to the steady angle: 0 swing.
  const early = arc.find((s) => s.t >= entryT + 0.3) ?? arc[arc.length - 1];
  const dir = Math.sign(early.hitchYawDeg) || 1;
  let peak = arc[0];
  for (const s of arc) if ((s.hitchYawDeg - steady) * dir > (peak.hitchYawDeg - steady) * dir) peak = s;

  // No swing to speak of: settling is just the approach to the steady angle.
  if ((peak.hitchYawDeg - steady) * dir <= SETTLE_BAND) {
    peak = arc.find((s) => Math.abs(s.hitchYawDeg - steady) <= SETTLE_BAND) ?? peak;
  }

  // Last moment after the peak the yaw was outside the settle band; settled from the next frame on.
  let lastOut = null;
  for (const s of arc) if (s.t >= peak.t && Math.abs(s.hitchYawDeg - steady) > SETTLE_BAND) lastOut = s;
  const settledT = lastOut ? lastOut.t : peak.t;

  const r = (v, d = 2) => +v.toFixed(d);
  return {
    hitchLoose: config.hitchLoose,
    trailerSpeed: config.trailerSpeed,
    cornerEntryT: r(entryT),
    steadyCornerAngleDeg: r(steady, 1),
    peakYawDeg: r(peak.hitchYawDeg, 1),
    peakT: r(peak.t),
    overshootPastSteadyDeg: r(Math.max(0, (peak.hitchYawDeg - steady) * dir), 1),
    settleBandDeg: SETTLE_BAND,
    settleAfterPeakS: r(Math.max(0, settledT - peak.t)),
    settleAfterEntryS: r(settledT - entryT),
    settledBeforeCornerExit: settledT < exitT - 1.5,
  };
}
