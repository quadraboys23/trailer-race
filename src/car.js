import { RAPIER } from './physics.js';
import { cfg, MODEL } from './config.js';
import { pointAt, PERIMETER } from './track.js';

// The player car: a dynamic box with an arcade top-down tyre model.
//   - Longitudinal: speed is pushed toward a target speed at the Acceleration
//     rate (or the brake rate), along the car's heading.
//   - Lateral: sideways slip is removed at a rate set by Tire grip, up to a
//     sideways-acceleration cap, past which the car slides. Grip is measured
//     against the ground here; M4 swaps in the trailer's velocity on the deck.
//   - Yaw: the car turns toward the steering target at up to Steering rate.
//     Set directly, not via torque, so there is no steering lag to tune out.

export const CAR = { ...MODEL.car };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Car {
  constructor(world) {
    const start = pointAt(PERIMETER - CAR.startBehind, 0);
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(start.x, start.y)
        .setRotation(start.angle)
        .setCcdEnabled(true)
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(CAR.len / 2, CAR.wid / 2)
        .setMass(CAR.mass)
        .setFriction(CAR.friction)
        .setRestitution(CAR.restitution),
      this.body
    );
    this.braking = false;
    this.targetSpeed = 0;
  }

  /**
   * One fixed step.
   * @param {number} dt
   * @param {{ target: {x:number,y:number}|null, steerAxis: number, brake: boolean }} ctl
   *   target: world point to steer toward (drag-to-point), or null
   *   steerAxis: -1..1 from the keyboard, used when there is no target
   *   brake: second finger / space
   */
  step(dt, ctl) {
    const b = this.body;
    const a = b.rotation();
    const fx = Math.cos(a);
    const fy = Math.sin(a);
    const rx = -fy;
    const ry = fx;
    const p = b.translation();
    const v = b.linvel();
    const vFwd = v.x * fx + v.y * fy;
    const vLat = v.x * rx + v.y * ry;
    const m = CAR.mass;

    // --- Target speed.
    let target = cfg.topSpeed;
    let decel = cfg.accel * CAR.brakeToAccel;
    if (cfg.distanceThrottle) {
      // Thumb distance ahead of the car sets the speed. No brake finger.
      const ahead = ctl.target ? (ctl.target.x - p.x) * fx + (ctl.target.y - p.y) * fy : 0;
      target = cfg.topSpeed * Math.min(1, Math.max(0, ahead / CAR.distanceThrottleRange));
      this.braking = false;
    } else {
      this.braking = ctl.brake;
      if (ctl.brake) target = 0;
    }
    this.targetSpeed = target;

    // --- Longitudinal.
    const dvFwd = Math.min(cfg.accel * dt, Math.max(-decel * dt, target - vFwd));

    // --- Lateral grip against the ground.
    const k = cfg.tireGrip * CAR.gripRateAtFull;
    const capDv = cfg.tireGrip * CAR.gripAccelAtFull * dt;
    let dvLat = -vLat * (1 - Math.exp(-k * dt));
    if (Math.abs(dvLat) > capDv) dvLat = Math.sign(dvLat) * capDv;
    this.sliding = Math.abs(vLat * (1 - Math.exp(-k * dt))) > capDv;

    b.applyImpulse({ x: (fx * dvFwd + rx * dvLat) * m, y: (fy * dvFwd + ry * dvLat) * m }, true);

    // --- Yaw.
    const speed = Math.hypot(v.x, v.y);
    const steerScale = Math.min(1, speed / CAR.fullSteerSpeed);
    let w = 0;
    if (ctl.target) {
      const dx = ctl.target.x - p.x;
      const dy = ctl.target.y - p.y;
      // A thumb right on top of the car has no direction: hold the heading.
      if (Math.hypot(dx, dy) > CAR.len / 2) {
        const err = wrap(Math.atan2(dy, dx) - a);
        w = Math.max(-cfg.steerRate, Math.min(cfg.steerRate, err / dt));
      }
    } else {
      w = ctl.steerAxis * cfg.steerRate;
    }
    b.setAngvel(w * steerScale, true);
  }

  pose() {
    const t = this.body.translation();
    return { x: t.x, y: t.y, angle: this.body.rotation() };
  }

  speed() {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y);
  }
}
