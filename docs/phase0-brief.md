# Trailer Race — Phase 0 Brief

2026-09-21 · @Someone

## Purpose

Phase 1 answers one question: is steering a car onto a moving trailer fun enough to replay for 20 minutes? This brief fixes only the decisions the prototype needs. Everything else waits until that question is answered.

## Core concept

A pickup tows a flatbed trailer around a short oval. The player drives a junker car and must get it onto the moving trailer and stop there. Come in too fast or crooked and the car bounces off; match speed and angle and it lands. Inspired by real short-track trailer races; no licensed IP, names or likenesses.

## Locked decisions

These are recommended defaults; change any before Phase 1 starts, not during it.

| Area | Decision | Why |
| --- | --- | --- |
| Camera | 2D top-down, camera follows the player car | Avoids 3D moving-platform physics entirely |
| Controls | Touch/drag or arrow keys to steer; auto-throttle | One-thumb play on a phone |
| Landing rule | Deck is a zone: entry from the rear, angle within tolerance, speed within tolerance of the trailer, then a hold on the deck | Fakes the ramp; tunable, forgiving |
| Landing result | Car locks to the trailer with a joint; round won | Clear, satisfying finish |
| Failed approach | Car is pushed back or spun off with an impulse scaled to the error | Failure is visible and funny |
| Truck | Drives a fixed racing line at constant speed; trailer on a pivot hitch | Predictable target; fishtail comes free |
| Round | Solo time trial: land as fast as possible, restart instantly | Isolates the feel question |
| Platform | Browser, portrait, playable on phone via a link | Zero cost, fast iteration |
| Stack | Phaser 3 + Rapier 2D (planck.js fallback), plain JavaScript | Free, text-only, Claude Code friendly |

## Open decisions for Walker

Pick one per line; my recommendation is first.

- [ ] **Steering input:** drag-to-point (car steers toward your thumb) vs left/right tap zones
- [ ] **Throttle:** auto-throttle with hold-to-brake vs hold-to-accelerate
- [ ] **Track:** simple oval vs figure-eight (crossover adds chaos, but also AI work later)
- [ ] **Trailer speed:** constant vs slowly ramping up each lap
- [ ] **Win condition:** hold on deck for 2 seconds vs instant on lock
- [ ] **Dummy traffic:** none vs 2–3 cars driving a fixed line (obstacles only, no AI)

## Tuning sliders

The prototype ships with an on-screen debug panel so feel is tuned by playing, not by re-prompting. Values save to a shareable URL so a good setting is never lost.

| Slider | Controls |
| --- | --- |
| Player top speed | How fast the car can go |
| Acceleration | How quickly it reaches speed |
| Tire grip | Drift vs rails |
| Steering rate | How sharply it turns |
| Trailer speed | Target speed to match |
| Landing angle tolerance (degrees) | How straight the entry must be |
| Landing speed tolerance (%) | How closely speed must match |
| Bounce-off strength | How hard a bad approach is punished |
| Hitch looseness | How much the trailer fishtails |

## Out of scope for Phase 1

None of these get built, even if a session has spare time:

- AI opponents (dummy traffic at most)
- Art beyond coloured rectangles, sound, music
- Menus, settings, scores that persist, progression, unlocks
- Multiple tracks or vehicles
- Monetization, analytics, app-store builds
- Performance work beyond "runs smoothly on Walker's phone"

## Pass/fail test

Phase 1 passes if, after tuning, all three are true:

1. Walker plays 20 minutes and still wants another attempt.
2. At least two other people (family counts) replay it unprompted after their first landing.
3. A failed landing reads as funny, not unfair.

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
