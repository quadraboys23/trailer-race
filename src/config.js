// Every tunable lives here. A magic number in a force calculation is a missing slider.
// The debug panel (M5) renders these; the URL query string overrides the defaults.

export const SLIDERS = {
  topSpeed:       { label: 'Player top speed',  min: 5,   max: 40,  step: 0.5,  def: 22,   unit: 'm/s' },
  accel:          { label: 'Acceleration',      min: 2,   max: 40,  step: 0.5,  def: 14,   unit: 'm/s²' },
  tireGrip:       { label: 'Tire grip',         min: 0,   max: 1,   step: 0.01, def: 0.85, unit: '' },
  steerRate:      { label: 'Steering rate',     min: 0.5, max: 8,   step: 0.1,  def: 3.2,  unit: 'rad/s' },
  trailerSpeed:   { label: 'Trailer speed',     min: 2,   max: 17,  step: 0.5,  def: 13,   unit: 'm/s' },
  deckGrip:       { label: 'Deck grip',         min: 0,   max: 1,   step: 0.01, def: 0.55, unit: '' },
  overhangPenalty:{ label: 'Overhang penalty',  min: 0,   max: 1,   step: 0.01, def: 0.7,  unit: '' },
  fallImpulse:    { label: 'Fall-off impulse',  min: 0,   max: 20,  step: 0.5,  def: 6,    unit: '' },
  hitchLoose:     { label: 'Hitch looseness',   min: 0,   max: 1,   step: 0.01, def: 0.45, unit: '' },
  shoveStrength:  { label: 'Shove strength',    min: 0,   max: 60,  step: 1,    def: 18,   unit: '' },
  roundLength:    { label: 'Round length',      min: 10,  max: 180, step: 5,    def: 60,   unit: 's' },
};

export const TOGGLES = {
  distanceThrottle: { label: 'Distance throttle', def: false },
};

// Fixed model constants: part of how the physics works, not player-facing
// knobs, so they have no slider (the brief fixes the slider list at eleven).
// Walker's rule, 2026-09-25: model constants live here, named and explained;
// only tunables a player-tester would reach for get a slider. Why each value
// is what it is: see the comments where it is used in src/rig.js.
export const MODEL = {
  trailerStiffMax: 90000, // N/rad of tyre slip at hitchLoose 0: tracks tightly
  trailerStiffMin: 16000, // N/rad at hitchLoose 1; below ~15000 it jackknifes
  trailerGripCap: 10000, // N, trailer tyre friction limit
  hitchDamp: 30000, // N*m per rad/s of trailer yaw rate relative to the truck
  trailerLinearDamping: 0.15, // Rapier damping, 1/s
  trailerAngularDamping: 0.05, // Rapier damping, 1/s
  // Below this forward speed the slip angle uses this instead, so the tyre
  // force stays finite when the trailer is (nearly) stopped.
  trailerSlipSpeedFloor: 1, // m/s

  // Geometry and contact. Metres, local +x is forward.
  truck: {
    len: 5.6,
    wid: 2.3,
    hitchX: -2.9, // hitch ball, behind the truck's centre
    friction: 0.4, // Rapier contact friction against the car
    restitution: 0.1, // bounciness when the car hits it
  },
  trailer: {
    deckLen: 7.0, // deck runs local x in [-3.5, +3.5]
    deckWid: 2.6,
    drawbarX: 4.6, // hitch anchor, ahead of the deck
    axleX: -1.2, // where lateral grip is applied; behind centre, as on a real trailer
    headboardX: 3.4, // solid bulkhead at the front of the deck
    headboardHalf: 0.16,
    headboardFriction: 0.5, // contact friction when the car hits the headboard
    headboardRestitution: 0.2, // bounce off the headboard on an overshoot
    mass: 1200, // kg; with the deck size, sets inertia and the swing's frequency
  },

  // Player car. Arcade top-down model; see src/car.js.
  car: {
    len: 4.2,
    wid: 1.8,
    mass: 1100, // kg
    friction: 0.5, // Rapier contact friction
    restitution: 0.15, // bounce off the truck / headboard
    // Tire grip slider at 1.0 means: sideways slip dies away at this rate (1/s)...
    gripRateAtFull: 30,
    // ...up to this much sideways acceleration (m/s^2), after which it slides.
    // At the 0.85 default that is 17 m/s^2, enough for top speed round the oval.
    gripAccelAtFull: 20,
    brakeToAccel: 2, // braking decel = this x the Acceleration slider
    fullSteerSpeed: 3, // m/s; below this the turn rate scales down, so it can't spin in place
    // Distance throttle: a thumb this far ahead of the car (m) asks for top speed.
    distanceThrottleRange: 25,
    startBehind: 20, // m of racing line behind the truck's start point
  },
};

/** Live values. Mutated by the debug panel; read every physics step. */
// Trailer speed tops out at 17 m/s deliberately: measured, a 28m corner radius
// cannot hold a trailer faster than that at any looseness — past 18 it walks
// itself into a jackknife. Raise the track radius before raising this.
export const cfg = {};

// Headless test harnesses import this module with no DOM. Guarding here (rather
// than stubbing a fake `window` in the harness) matters: a fake window makes
// rapier-compat take its browser load path and leaves the WASM broken.
const hasDom = typeof window !== 'undefined' && !!window.location;

function applyUrl() {
  const q = new URLSearchParams(hasDom ? window.location.search : '');
  for (const [key, s] of Object.entries(SLIDERS)) {
    const raw = q.get(key);
    const n = raw === null ? NaN : Number(raw);
    cfg[key] = Number.isFinite(n) ? Math.min(s.max, Math.max(s.min, n)) : s.def;
  }
  for (const [key, t] of Object.entries(TOGGLES)) {
    const raw = q.get(key);
    cfg[key] = raw === null ? t.def : raw === '1' || raw === 'true';
  }
}

/** Writes current values to the URL, so copying the address bar saves a setting. */
export function syncUrl() {
  if (!hasDom) return;
  const q = new URLSearchParams();
  for (const [key, s] of Object.entries(SLIDERS)) {
    if (cfg[key] !== s.def) q.set(key, String(cfg[key]));
  }
  for (const [key, t] of Object.entries(TOGGLES)) {
    if (cfg[key] !== t.def) q.set(key, cfg[key] ? '1' : '0');
  }
  const qs = q.toString();
  window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
}

applyUrl();
