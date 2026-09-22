import { RAPIER } from './physics.js';
import { cfg } from './config.js';
import { sampleLine, PERIMETER } from './track.js';

// Truck + flatbed trailer. All dimensions in metres; local +x is forward.

export const TRUCK = { len: 5.6, wid: 2.3, hitchX: -2.9 };

export const TRAILER = {
  deckLen: 7.0, // deck runs local x in [-3.5, +3.5]
  deckWid: 2.6,
  drawbarX: 4.6, // hitch anchor, ahead of the deck
  axleX: -1.2, // where lateral grip is applied; behind centre, as on a real trailer
  headboardX: 3.4, // solid bulkhead at the front of the deck
  headboardHalf: 0.16,
  mass: 1200,
};

TRAILER.deckHalfLen = TRAILER.deckLen / 2;
TRAILER.deckHalfWid = TRAILER.deckWid / 2;
// Box inertia about the centre: m * (w^2 + h^2) / 12
TRAILER.inertia = (TRAILER.mass * (TRAILER.deckLen ** 2 + TRAILER.deckWid ** 2)) / 12;

// Effective mass seen by a sideways impulse applied AT THE AXLE rather than at
// the centre of mass. Part of such an impulse becomes spin, so the body resists
// it less than its full mass would suggest. Using TRAILER.mass here instead
// over-corrects by ~30%, which oscillates and then blows the solver up.
TRAILER.lateralEffMass = 1 / (1 / TRAILER.mass + TRAILER.axleX ** 2 / TRAILER.inertia);

// Hitch looseness -> axle grip, geometrically not linearly. Measured response to a
// sideways kick: grip 1.0 swings 0.1deg, 0.6 swings 1.2deg, 0.2 swings 6.5deg,
// 0.07 swings ~16deg and oscillates. Nearly all the feel lives below 0.5, so a
// linear slider would be dead over its first half. Yaw damping was measured too
// and does nothing here — the tyres do the damping, so the axle is the only knob.
const GRIP_MAX = 0.95;
const GRIP_MIN = 0.07;
export const gripForLooseness = (loose) =>
  GRIP_MAX * (GRIP_MIN / GRIP_MAX) ** Math.min(1, Math.max(0, loose));

const rot = (a, x, y) => ({ x: x * Math.cos(a) - y * Math.sin(a), y: x * Math.sin(a) + y * Math.cos(a) });

export class Rig {
  constructor(world) {
    this.world = world;
    this.s = 0; // arc length along the racing line

    const start = sampleLine(0);

    // --- Truck: kinematic, driven along the line. Solid, so overshooting hits it.
    this.truck = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased()
        .setTranslation(start.x, start.y)
        .setRotation(start.angle)
    );
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRUCK.len / 2, TRUCK.wid / 2).setFriction(0.4).setRestitution(0.1),
      this.truck
    );

    // --- Trailer: dynamic, hung off a revolute hitch.
    const hitch = rot(start.angle, TRUCK.hitchX, 0);
    const hx = start.x + hitch.x;
    const hy = start.y + hitch.y;
    const back = rot(start.angle, -TRAILER.drawbarX, 0);

    this.trailer = world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(hx + back.x, hy + back.y)
        .setRotation(start.angle)
        .setLinearDamping(0.15)
        .setAngularDamping(0.05)
        // Mass is set explicitly: the deck collider is a weightless sensor.
        .setAdditionalMassProperties(TRAILER.mass, { x: 0, y: 0 }, TRAILER.inertia)
    );

    // The deck is a SENSOR: no rails, nothing stops the car sliding off the sides.
    this.deckCollider = world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRAILER.deckHalfLen, TRAILER.deckHalfWid)
        .setSensor(true)
        .setDensity(0),
      this.trailer
    );

    // The headboard at the front of the deck IS solid — this is the "tailgate"
    // that a car overshooting the deck slams into.
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(TRAILER.headboardHalf, TRAILER.deckHalfWid)
        .setTranslation(TRAILER.headboardX, 0)
        .setDensity(0)
        .setFriction(0.5)
        .setRestitution(0.2),
      this.trailer
    );

    world.createImpulseJoint(
      RAPIER.JointData.revolute({ x: TRUCK.hitchX, y: 0 }, { x: TRAILER.drawbarX, y: 0 }),
      this.truck,
      this.trailer,
      true
    );
  }

  /** One fixed physics step. */
  step(dt) {
    // Truck walks the racing line. setNextKinematic* (not setTranslation) so the
    // hitch joint and every contact see the truck's velocity.
    this.s = (this.s + cfg.trailerSpeed * dt) % PERIMETER;
    const p = sampleLine(this.s);
    this.truck.setNextKinematicTranslation({ x: p.x, y: p.y });
    this.truck.setNextKinematicRotation(p.angle);

    this.applyTrailerGrip();
  }

  /**
   * Trailer tyres. Lateral velocity at the axle is cancelled by an impulse
   * applied AT the axle, so it produces the yaw torque that makes it fishtail.
   * Hitch looseness is how little of that lateral velocity gets cancelled.
   */
  applyTrailerGrip() {
    const b = this.trailer;
    const a = b.rotation();
    const axle = rot(a, TRAILER.axleX, 0);
    const px = b.translation().x + axle.x;
    const py = b.translation().y + axle.y;

    const v = b.linvel();
    const w = b.angvel();
    // velocity of the axle point = linear + omega x r
    const vx = v.x - w * axle.y;
    const vy = v.y + w * axle.x;

    const rx = -Math.sin(a); // body "right" axis
    const ry = Math.cos(a);
    const lateral = vx * rx + vy * ry;

    if (!Number.isFinite(lateral)) return;

    // grip 1 cancels the axle's sideways slip exactly; low values let it swing.
    // gripOverride is for the headless harnesses only; the game never sets it.
    const grip = this.gripOverride ?? gripForLooseness(cfg.hitchLoose);
    const j = -lateral * TRAILER.lateralEffMass * grip;

    b.applyImpulseAtPoint({ x: rx * j, y: ry * j }, { x: px, y: py }, true);
  }

  /** Trailer pose + the deck rectangle in world space, for rendering and the on-deck test. */
  pose() {
    const t = this.trailer.translation();
    return { x: t.x, y: t.y, angle: this.trailer.rotation() };
  }
}
