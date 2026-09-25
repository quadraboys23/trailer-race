# Phase 1 acceptance criteria

Set by Walker on 2026-09-25. The reviewer agent (`.claude/agents/reviewer.md`)
judges each milestone against this file, `docs/phase0-brief.md` and `CLAUDE.md`,
using the captures in `captures/<milestone>/`. Nothing goes to Walker without a
reviewer PASS.

## Reference behaviour

Written notes from the real trailer-race video. The video itself stays out of
the repo.

- Open flatbeds, no rails. Cars mount via the rear ramps.
- A car parked off-centre and overhanging slides off the outside of the trailer
  in a corner, with no contact at all.
- A car on the deck gets rammed from the side in a turn, tilts, hangs half off,
  then falls.
- A rival shoves the car on the deck from behind, trying to take its place.
- The winner is whoever is on the trailer at the checkered flag.

Phase 1 has no rivals (see the brief); the Shove button stands in for the rams
and shoves.

## M2 — track, truck, fishtailing trailer

- Overview capture over a corner entry.
- `hitchLoose=1`: the trailer swings at least 10° past its steady corner angle
  and settles in 1–2 s.
- `hitchLoose=0`: near rigid.
- Default (0.4 per Walker's note; the shipped default is whatever `SLIDERS.hitchLoose.def`
  says) sits visibly between the two.
- Overview toggle is an on-screen button top-right plus the Z key. A tap on the
  play area does **not** toggle it.

Measurement definitions (in `scripts/scenarios/_hitch.mjs`): the steady corner
angle is the mean hitch yaw over the last 1.5 s of the first corner. The swing is
how far the yaw goes past that steady angle in the direction the trailer first
yaws on entry. Settled means the yaw stays within ±1° of steady; the settle time
is measured from the peak of the swing (time from corner entry is reported too).

## M3 — player car

- Scripted input drives 3 clean laps.
- Default top speed is at least 1.3× trailer speed, so catching up is possible.
- Steering responds with no visible lag in the captures.
- Second-finger brake visibly slows the car.
- **Human checkpoint:** driving feel.

## M4 — on-deck model

Scripted tests, each captured:

- a) A car placed centred and aligned on the deck survives 3 full laps at defaults.
- b) A car placed with 40% overhang falls off within the first corner.
- c) Default Shove knocks a centred car off in no more than 3 hits, and not in 1.
- d) Overshooting the deck hits the headboard, not through it.
- e) Timer end judges win/loss correctly in both states.

a) and b) must both hold. That is the "skill, not luck" test.

- **Human checkpoint.**

## M5 — HUD, debug panel

- Debug panel usable at 390 px width.
- Every slider round-trips through the URL.
- Restart resets all state.
- **Human checkpoint:** the 20-minute pass/fail test.
