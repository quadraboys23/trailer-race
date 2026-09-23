# CLAUDE.md — Trailer Race

Phase 1 feel prototype. `docs/phase0-brief.md` is the source of truth for scope
and intent; it was updated on 2026-09-21 for the stay-on-the-trailer loop and
this file agrees with it. This file adds the implementation rules the brief does
not cover. If the two ever disagree, stop and ask — do not pick one.

## The one question

Is getting a car onto a moving trailer, and keeping it there, fun enough to
replay for 20 minutes?

Everything in this repo exists to answer that. If a change does not make the
landing or the survival feel better, or easier to tune, it does not belong in
Phase 1.

## Core loop

**Getting on the trailer is not the win. Staying on it is.**

The round is a countdown. The player drives onto the moving flatbed from the rear
and has to stay parked on the deck until the clock runs out. A car parked crooked
or hanging off the edge slides off in the corners. Impacts knock it off. Win if
the car is on the deck when the round ends.

There is no landing "check", no success joint, no scripted bounce. Whether the
car stays on is decided by physics and by how well it is parked.

## Hard scope limits

Do not build these, even with spare time in a session:

- AI opponents. Dummy traffic is not in the build.
- Art beyond coloured rectangles. No sprites, no sound, no music.
- Menus, settings screens, persisted scores, progression, unlocks.
- More than one track or one vehicle.
- Monetization, analytics, app-store builds, service workers, PWA manifests.
- Performance work beyond "runs smoothly on Walker's phone".
- Tests, CI, linters, TypeScript, state-management libraries, build tooling
  beyond the Vite dev server.

Adding a dependency is a scope change. Ask first.

## Stack (pinned, exact versions — no carets)

| Thing | Version | Note |
| --- | --- | --- |
| Phaser | 3.90.0 | Rendering, input, camera, game loop. Phaser 3, not 4. |
| @dimforge/rapier2d-compat | 0.20.0 | Physics. `-compat` build: WASM is inlined, no Vite WASM config. |
| Vite | 7.3.6 | Dev server and build. No plugins. |
| Language | plain JavaScript, ES modules | No TypeScript, no JSX, no config beyond defaults. |

Versions are confirmed with `npm view <pkg>@<version> version` before they go
into `package.json`. Same check applies to any future version bump.

Rapier is the only physics engine in this repo. planck.js was dropped as a
fallback on 2026-09-21; do not reach for it.

Phaser does **not** run its own physics. Arcade and Matter stay off. Rapier owns
all bodies; Phaser draws Graphics at the positions Rapier reports.

## Decisions locked for Phase 1

- **Steering:** drag-to-point. One finger; the car steers toward it.
- **Braking:** a *second* finger held anywhere brakes. Keyboard: arrows steer,
  space brakes. Rest-to-brake was considered and **rejected**: holding the thumb
  still is exactly what lining up for the ramp requires. Do not re-propose it.
- **Alternate input (debug toggle):** "distance throttle" — the thumb's distance
  ahead of the car sets target speed, no brake finger at all. Toggleable at
  runtime so the two schemes can be compared back to back.
- **Throttle:** auto-throttle in the default scheme.
- **Track:** simple oval. No figure-eight.
- **Trailer:** open flatbed, no rails. The deck is a **sensor zone**, not a solid
  body, so nothing stops the car sliding off the sides. The **truck's rear /
  tailgate is solid**, so overshooting the deck means hitting the truck.
- **Mounting:** the car only mounts via the **rear ramp edge** of the deck.
  Arriving over a side edge does not put it on deck.
- **Trailer speed:** constant. No per-lap ramp.
- **Win condition:** on the deck when the round timer ends.
- **Dummy traffic:** none.
- **Orientation:** portrait. Camera follows the player car.

## On-deck model

This is the heart of the prototype; get it right before anything else is polished.

- **On deck** while the car's centre of mass is inside the deck outline
  (trailer-local rectangle). That is the whole test — no timers, no tolerances.
- **Grip while on deck:** lateral friction and drag are computed against the
  **trailer's** velocity at the car's position, not against the ground. The
  resulting force is **capped** (the deck grip slider), so cornering forces and
  impacts can overcome it. This is what makes a bad park slide off in a turn.
- **Grip scales down** with:
  - *overhang* — how much of the car's footprint is outside the deck outline,
  - *misalignment* — angle between car and trailer.
- **Falling off:** when the centre of mass leaves the outline, grip switches back
  to the ground, a small drop/spin impulse is applied, and the player gets about
  0.5s of reduced control.
- **Fake height:** while on deck the car is drawn slightly larger with an offset
  shadow. No real z-axis anywhere.

## Truck and hitch

The truck is a **KinematicPositionBased** body driven along the racing line with
`setNextKinematicTranslation` / `setNextKinematicRotation`, never by writing
its translation directly — the kinematic velocity has to be visible to the hitch
joint and to contacts, or the trailer and the car will read the truck as static.

The trailer is a dynamic body on a revolute joint at the hitch. Its tyres use a
**slip-angle** model: lateral force proportional to slip angle, capped at a
friction limit. "Hitch looseness" lowers the cornering stiffness.

Do not replace this with a force proportional to lateral velocity. That was tried
twice and fails for a structural reason: such a force is a damper, and a damper
can only remove energy, so the trailer overshoots by 0.0deg at every slider
setting and the knob looks broken. Capping the damper does not fix it either — it
removes damping without adding a restoring force, so the trailer slides wide for
ever instead of swinging back. Slip angle gives a spring proportional to yaw,
which is what actually rings down.

Measured at 13 m/s: looseness 0 gives 0.0deg of swing past the steady corner
angle, 0.4 gives 4.1deg, 1.0 gives 11.9deg and settles in 1.7s.

## Units and conventions

- Physics is in **metres and seconds**. Rendering multiplies by `PX_PER_M`.
- Angles are radians everywhere except the debug panel, which shows degrees.
- Fixed timestep. Rapier steps at a constant dt; physics never reads a variable
  frame delta.
- Every tunable lives in one config object with a slider, not inline in the
  physics code. A magic number in a force calculation is a missing slider.

## Tuning sliders

The same eleven as the brief, plus the distance-throttle toggle, the Shove
button and Restart. Keep this table and the brief's in step:

| Slider | Controls |
| --- | --- |
| Player top speed | How fast the car can go |
| Acceleration | How quickly it reaches speed |
| Tire grip (ground) | Drift vs rails on the track |
| Steering rate | How sharply it turns |
| Trailer speed | Target speed to match |
| Hitch looseness | How much the trailer fishtails |
| Deck grip | Cap on the force holding the car to the deck |
| Overhang penalty | How much a sloppy park costs in grip |
| Round length | Countdown, default 60s |
| Fall-off impulse | Size of the drop/spin kick when it slides off |
| Shove strength | Size of the debug Shove impulse |

Values are encoded in the URL query string, so a setting worth keeping is saved
by copying the URL. Tuning happens by playing and dragging sliders, not by asking
Claude to change a constant.

## How to run

```sh
npm install
npm run dev          # http://localhost:5180
```

The port is **5180, not Vite's default 5173**. Another project on this machine
binds `[::1]:5173`, and macOS resolves `localhost` to `::1` first, so both
servers start "successfully" and `localhost:5173` silently serves the wrong app.
`strictPort` is on so a future clash fails loudly.

On a phone, same Wi-Fi network:

```sh
npm run dev -- --host
```

Vite prints a `Network:` URL (e.g. `http://192.168.x.x:5180`). Open it on the
phone. **Re-read that line every session** — this machine's LAN IP has already
changed once mid-project, which silently breaks a phone URL from a previous day.
Nothing is deployed; there is no hosting step in Phase 1.

```sh
npm run build        # dist/, only needed when we put it on itch.io
```

## Phase 1 milestones

- [ ] **M1** Vite + Phaser + Rapier scaffold. Empty scene runs on desktop and on
      the phone over LAN. *Stop here for Walker's phone check.*
- [ ] **M2** Oval track drawn. Kinematic truck follows the racing line at
      constant speed, trailer on a revolute hitch and fishtails. Solid tailgate,
      sensor deck.
- [ ] **M3** Player car: top-down lateral-friction physics, drag-to-steer,
      auto-throttle, two-finger brake, distance-throttle toggle. Camera follows.
- [ ] **M4** On-deck state: rear-edge mounting, deck-relative capped grip,
      overhang and misalignment penalties, fall-off impulse and control loss,
      fake-height rendering.
- [ ] **M5** Round timer and HUD (countdown, time-on-deck, on/off state, win at
      the end). Debug panel with all sliders, values in the URL, instant restart,
      Shove button.

Session budget: Phase 1 stops after 5 Claude Code sessions, pass or fail.

## Pass/fail

1. Walker plays 20 minutes and still wants another attempt.
2. Two other people replay it unprompted after their first landing.
3. Falling off reads as funny, not unfair.
4. Staying on through corners feels like a skill — a clean park survives, a
   sloppy one doesn't — not luck.

Criterion 4 is the one the on-deck grip model is judged on. If a good park and a
bad park survive equally often, the prototype has failed even if it is fun.
