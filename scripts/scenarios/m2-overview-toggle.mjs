// Overview toggles from the top-right button and from Z. A tap on the play
// area must NOT toggle it: that touch is the steering input from M3 on.
const CENTRE = { x: 195, y: 500 };
const EXPECT = [
  [0.4, false, 'start'],
  [0.9, false, 'after tap on play area'],
  [1.4, true, 'after overview button'],
  [2.4, false, 'after Z'],
  [3.4, true, 'after Z again'],
];

export default {
  milestone: 'm2',
  name: 'overview-toggle',
  title: 'button + Z toggle overview; tapping the play area does not',
  duration: 3.5,
  frames: EXPECT.map(([t]) => t),
  input: [
    { t: 0.5, touch: [CENTRE] },
    { t: 0.6, touch: [] },
    { t: 1.0, click: '#overview' },
    { t: 2.0, press: 'z' },
    { t: 3.0, press: 'z' },
  ],
  label: (s) => `overview ${s.overview}`,
  analyse(trace) {
    const at = (t) => trace.find((s) => s.t >= t - 1e-6);
    const checks = EXPECT.map(([t, want, what]) => ({ what, t, want, got: at(t).overview }));
    return { pass: checks.every((c) => c.want === c.got), checks };
  },
};
