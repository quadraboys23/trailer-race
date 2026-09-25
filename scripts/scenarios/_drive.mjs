// Scripted player for M3+: steers by holding a synthetic finger on a point a
// little way ahead along a lane of the track, exactly as a thumb would. The
// camera follows the car, so the finger's screen position is recomputed from
// world metres every tick by the harness.
import { project, pointAt, PERIMETER } from '../../src/track.js';

export const LANE_OUTSIDE = 5; // m outside the racing line: clear of the truck and trailer

/** Finger on the lane, `look` metres ahead of the car's projection. */
export function laneFinger(car, { lane = LANE_OUTSIDE, look = 10, id = 0 } = {}) {
  const s = project(car.x, car.y).s;
  const p = pointAt(s + look, lane);
  return { id, wx: p.x, wy: p.y };
}

/** Finger at a fixed bearing/distance from the car, relative to its heading. */
export function relativeFinger(car, { bearing, dist, id = 0 }) {
  const a = car.angle + bearing;
  return { id, wx: car.x + Math.cos(a) * dist, wy: car.y + Math.sin(a) * dist };
}

// A second finger, well away from the steering thumb: the brake.
export const BRAKE_FINGER = { id: 1, x: 300, y: 760 };

export const deg = (r) => (r * 180) / Math.PI;
export const r2 = (v, d = 2) => +v.toFixed(d);
export { PERIMETER };
