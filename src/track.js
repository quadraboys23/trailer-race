// A stadium oval: two straights joined by two semicircles, parametrised by
// arc length so "constant speed" is just `s += speed * dt`.
//
// Note the curvature jumps from 0 to 1/R at each straight-to-arc junction.
// That is deliberate and free: it kicks the trailer four times a lap, which is
// where most of the fishtail comes from.

export const TRACK = {
  straight: 60, // m, length of each straight
  radius: 28, // m, radius of each end
  width: 16, // m, asphalt width
};

const { straight: L, radius: R } = TRACK;

export const SEG = {
  bottom: L,
  rightArc: Math.PI * R,
  top: L,
  leftArc: Math.PI * R,
};
export const PERIMETER = 2 * L + 2 * Math.PI * R;

/**
 * Position and heading at arc-length `s` along the racing line.
 * Travel order: bottom straight (+x), right arc, top straight (-x), left arc.
 * Screen axes, so +y is down.
 * @returns {{x:number,y:number,angle:number}}
 */
export function sampleLine(s) {
  let d = ((s % PERIMETER) + PERIMETER) % PERIMETER;

  if (d < SEG.bottom) {
    return { x: -L / 2 + d, y: R, angle: 0 };
  }
  d -= SEG.bottom;

  if (d < SEG.rightArc) {
    // theta runs 90deg -> -90deg around the centre of the right end.
    const theta = Math.PI / 2 - d / R;
    return {
      x: L / 2 + R * Math.cos(theta),
      y: R * Math.sin(theta),
      // tangent for decreasing theta is (sin, -cos)
      angle: Math.atan2(-Math.cos(theta), Math.sin(theta)),
    };
  }
  d -= SEG.rightArc;

  if (d < SEG.top) {
    return { x: L / 2 - d, y: -R, angle: Math.PI };
  }
  d -= SEG.top;

  const theta = -Math.PI / 2 - d / R;
  return {
    x: -L / 2 + R * Math.cos(theta),
    y: R * Math.sin(theta),
    angle: Math.atan2(-Math.cos(theta), Math.sin(theta)),
  };
}

/** Which of the four pieces arc length `s` falls on. */
export function segmentAt(s) {
  let d = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  for (const [name, len] of Object.entries(SEG)) {
    if (d < len) return name;
    d -= len;
  }
  return 'leftArc';
}

/**
 * Nearest point on the racing line: arc length `s` and signed `offset`
 * (metres, + is the outside of the oval). Inverse of sampleLine + normal.
 */
export function project(x, y) {
  if (Math.abs(x) <= L / 2) {
    if (y >= 0) return { s: x + L / 2, offset: y - R };
    return { s: L + SEG.rightArc + (L / 2 - x), offset: -y - R };
  }
  if (x > L / 2) {
    const theta = Math.atan2(y, x - L / 2); // pi/2 at the bottom, -pi/2 at the top
    return { s: L + (Math.PI / 2 - theta) * R, offset: Math.hypot(x - L / 2, y) - R };
  }
  let theta = Math.atan2(y, x + L / 2); // -pi/2 at the top, round to -3pi/2 at the bottom
  if (theta > -Math.PI / 2) theta -= 2 * Math.PI;
  return { s: 2 * L + SEG.rightArc + (-Math.PI / 2 - theta) * R, offset: Math.hypot(x + L / 2, y) - R };
}

/** A point `offset` metres outside the racing line at arc length `s`. */
export function pointAt(s, offset = 0) {
  const p = sampleLine(s);
  return { x: p.x - Math.sin(p.angle) * offset, y: p.y + Math.cos(p.angle) * offset, angle: p.angle };
}

/** Outer bound of the drawn asphalt, for framing the overview camera. */
export const TRACK_BOUNDS = {
  halfW: L / 2 + R + TRACK.width / 2,
  halfH: R + TRACK.width / 2,
};
