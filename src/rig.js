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

// Trailer tyres, as a slip-angle model.
//
// Two earlier models failed, and both failed for the same reason. A force
// proportional to lateral VELOCITY is a damper, and a damper can only remove
// energy, so it overshot by 0.0deg at every setting. Capping that damper did not
// help either: it removed damping without adding any restoring force, so below
// the cornering demand the trailer just slid wide for ever (steady angle 28-43deg,
// never recovering) instead of swinging back.
//
// Real tyres make force proportional to SLIP ANGLE. For a trailing body that is a
// spring proportional to yaw, which is the missing ingredient — a spring plus
// light damping is what overshoots and rings down. It also fixes a speed bug:
// the old damper's strength scaled with velocity, so it went rock solid at
// 13 m/s no matter what the slider said.
//
// Looseness lowers cornering stiffness: softer tyres, a slacker spring, more swing.
// The floor is 18000, not lower: below about 15000 the trailer stops recovering
// between corners and walks itself into a jackknife.
const STIFF_MAX = 90000; // N per radian of slip: tracks tightly, no visible swing
const STIFF_MIN = 18000; // N per radian: ~10deg of swing past the corner angle
// Interpolated in compliance (1/stiffness), which spreads the slider evenly.
// Geometric spacing bunched all the movement into the top quarter.
export const stiffnessForLooseness = (loose) => {
  const t = Math.min(1, Math.max(0, loose));
  return 1 / (1 / STIFF_MAX + t * (1 / STIFF_MIN - 1 / STIFF_MAX));
};

// Friction limit of the tyres, a bit above the cornering demand so the trailer
// holds a clean corner but lets go when shoved or hit.
const GRIP_CAP = 10000; // N

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

    this.applyTrailerGrip(dt);
  }

  /**
   * Trailer tyres. Lateral velocity at the axle is cancelled by an impulse
   * applied AT the axle, so it produces the yaw torque that makes it fishtail.
   * Hitch looseness is how little of that lateral velocity gets cancelled.
   */
  applyTrailerGrip(dt) {
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

    const fx = Math.cos(a); // body "forward" axis
    const fy = Math.sin(a);
    const rx = -Math.sin(a); // body "right" axis
    const ry = Math.cos(a);

    const vFwd = vx * fx + vy * fy;
    const vLat = vx * rx + vy * ry;
    if (!Number.isFinite(vLat) || !Number.isFinite(vFwd)) return;

    // Slip angle. The floor on forward speed keeps this finite at a standstill.
    const slip = Math.atan2(vLat, Math.max(Math.abs(vFwd), 1));

    // stiffnessOverride / capOverride are for the headless harnesses only.
    const stiffness = this.stiffnessOverride ?? stiffnessForLooseness(cfg.hitchLoose);
    const cap = this.capOverride ?? GRIP_CAP;

    let force = -stiffness * slip;
    if (Math.abs(force) > cap) force = Math.sign(force) * cap;
    const j = force * dt;

    b.applyImpulseAtPoint({ x: rx * j, y: ry * j }, { x: px, y: py }, true);
  }

  /** Trailer pose + the deck rectangle in world space, for rendering and the on-deck test. */
  pose() {
    const t = this.trailer.translation();
    return { x: t.x, y: t.y, angle: this.trailer.rotation() };
  }
}
