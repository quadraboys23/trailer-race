# Trailer Race — Phase 0 Brief

2026-09-21 · @Someone

## Purpose

Phase 1 answers one question: is getting onto a moving trailer, then staying on it through corners and hits, fun enough to replay for 20 minutes? This brief fixes only the decisions the prototype needs. Everything else waits until that question is answered.

## Core concept

A pickup tows an open flatbed trailer around a short oval. The player drives a junker car up the rear ramp onto the moving trailer, then has to stay on it until the round ends. A crooked or off-centre park slides off in the corners; a hard hit knocks the car off; too fast and it slams into the truck. Whoever is on the deck at the flag wins. Based on real short-track trailer races; no licensed IP, names or likenesses.

## Locked decisions

These are recommended defaults; change any before Phase 1 starts, not during it.

| Area | Decision | Why |
| --- | --- | --- |
| Camera | 2D top-down, camera follows the player car | Avoids 3D moving-platform physics entirely |
| Controls | One finger steers (drag-to-point); a second finger held anywhere brakes; auto-throttle. Keyboard: arrows + space | One-thumb driving, braking never fights steering |
| Alt control (debug toggle) | Distance throttle: thumb distance ahead of the car sets target speed | Compare by playing |
| Trailer | Open flatbed, no rails, rear ramp edge only; truck and tailgate solid | Matches the real races; overshoot means hitting the truck |
| Getting on | Car mounts only across the rear ramp edge; deck is a sensor zone | Emergent, not a scripted tolerance check |
| On-deck state | On deck while the car's centre of mass is inside the deck outline | Overhang decides, not a rule |
| Grip on deck | Friction relative to trailer velocity, capped; reduced by overhang and misalignment | Sloppy parks slide off in corners, as in the video |
| Falling off | Grip reverts to ground, small drop/spin impulse, \~0.5s reduced control; height faked with a larger car and offset shadow while on deck | Visible, funny failure |
| Truck | Kinematic body on a fixed racing line at constant speed (moved with setNextKinematic\*); trailer on a revolute hitch | Predictable target; fishtail comes free |
| Round and win | Round timer (default 60s); win if on the deck at the end; HUD shows on/off state and time on deck | Staying on is the game |
| Platform | Browser, portrait, playable on phone via a link | Zero cost, fast iteration |
| Stack | Phaser 3 + Rapier 2D (compat build), Vite, plain JavaScript, exact pinned versions | Free, text-only, Claude Code friendly |

## Resolved decisions

Settled 2026-09-21 after reviewing the reference video.

- [x] **Steering:** drag-to-point, second finger brakes (rest-to-brake rejected: holding still is exactly what lining up requires)
- [x] **Throttle:** auto-throttle; distance throttle available as a debug toggle
- [x] **Track:** simple oval
- [x] **Trailer speed:** constant
- [x] **Win condition:** on the deck when the round timer ends (replaces the 2s hold and joint lock)
- [x] **Traffic:** none in Phase 1; a debug Shove button simulates hits

## Tuning sliders

The prototype ships with an on-screen debug panel so feel is tuned by playing, not by re-prompting. Values save to a shareable URL so a good setting is never lost.

| Slider | Controls |
| --- | --- |
| Player top speed | How fast the car can go |
| Acceleration | How quickly it reaches speed |
| Tire grip | Drift vs rails on the track |
| Steering rate | How sharply it turns |
| Trailer speed | Target speed to match |
| Deck grip | How well a parked car holds on the trailer |
| Overhang penalty | How much a crooked or off-centre park loses grip |
| Fall-off impulse | How dramatic a fall is |
| Hitch looseness | How much the trailer fishtails |
| Shove strength | Force of the debug Shove button |
| Round length (s) | Timer before the flag; default 60 |

Plus a toggle for distance throttle, a Shove button, and Restart.

## Out of scope for Phase 1

None of these get built, even if a session has spare time:

- AI opponents and traffic (the Shove button stands in for hits)
- Art beyond coloured rectangles, sound, music
- Menus, settings, scores that persist, progression, unlocks
- Multiple tracks or vehicles
- Monetization, analytics, app-store builds
- Performance work beyond "runs smoothly on Walker's phone"

## Pass/fail test

Phase 1 passes if, after tuning, all four are true:

1. Walker plays 20 minutes and still wants another attempt.
2. At least two other people (family counts) replay it unprompted after their first landing.
3. Falling off reads as funny, not unfair.
4. Staying on through corners feels like a skill (a clean park survives, a sloppy one doesn't), not luck.

Pass → Phase 2: full design doc and a `CLAUDE.md` for the repo. Fail after honest tuning → shelve it; the cost was a few sessions. Time box: stop Phase 1 after 5 Claude Code sessions whatever the result.

## Tools and cost

Phase 1 costs $0 beyond the existing Claude subscription. Licences are as understood at drafting; confirm on each project's repo before shipping.

| Need | Tool | Licence / cost |
| --- | --- | --- |
| Game framework | Phaser 3 | MIT, free |
| Physics | Rapier 2D (planck.js fallback) | Apache-2.0 / MIT, free |
| AI (Phase 2+) | Yuka or hand-rolled state machine | MIT, free |
| Code and build | Claude Code, VS Code, Node.js, git | Existing subscription / free |
| Repo | GitHub (private repo) | Free |
| Phone testing and hosting | GitHub Pages or itch.io | Free |
| Art and audio (Phase 2+) | Kenney.nl, Freesound CC0 | Free, CC0 |

The only paid wall is app stores, well after Phase 1: Apple developer account about $99 USD/year, Google Play about $25 USD once. A browser build on itch.io stays free.
