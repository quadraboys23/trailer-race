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
