import { RAPIER } from './physics.js';
import { cfg, MODEL } from './config.js';
import { sampleLine, PERIMETER } from './track.js';

// Truck + flatbed trailer. Geometry and contact values live in MODEL
// (src/config.js); these add the derived values.

export const TRUCK = { ...MODEL.truck };
export const TRAILER = { ...MODEL.trailer };

TRAILER.deckHalfLen = TRAILER.deckLen / 2;
TRAILER.deckHalfWid = TRAILER.deckWid / 2;
// Box inertia about the centre: m * (w^2 + h^2) / 12
TRAILER.inertia = (TRAILER.mass * (TRAILER.deckLen ** 2 + TRAILER.deckWid ** 2)) / 12;

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
// The floor is 16000, not lower: below about 15000 the trailer stops recovering
// between corners and walks itself into a jackknife.
const STIFF_MAX = MODEL.trailerStiffMax; // tracks tightly, no visible swing
const STIFF_MIN = MODEL.trailerStiffMin; // ~11deg of swing past the corner angle

// Hitch friction: a torque against the trailer's yaw rate RELATIVE to the truck.
// Without it the swing rang on as a slow 2-3deg counter-swing and took 2.6s to
// settle. Rapier's own angular damping is no substitute: it damps absolute spin,
// so it fights the corner itself and shifts the steady angle instead.
// Measured at 13 m/s, looseness 1: 11.3deg of swing, settled (+-1deg) 1.4s after
// the peak. At 17 m/s it stays bounded (<24deg) with no jackknife.
const HITCH_DAMP = MODEL.hitchDamp;
// Interpolated in compliance (1/stiffness), which spreads the slider evenly.
// Geometric spacing bunched all the movement into the top quarter.
export const stiffnessForLooseness = (loose) => {
  const t = Math.min(1, Math.max(0, loose));
  return 1 / (1 / STIFF_MAX + t * (1 / STIFF_MIN - 1 / STIFF_MAX));
};

// Friction limit of the tyres, a bit above the cornering demand so the trailer
// holds a clean corner but lets go when shoved or hit.
const GRIP_CAP = MODEL.trailerGripCap;

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
      RAPIER.ColliderDesc.cuboid(TRUCK.len / 2, TRUCK.wid / 2).setFriction(TRUCK.friction).setRestitution(TRUCK.restitution),
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
        .setLinearDamping(MODEL.trailerLinearDamping)
        .setAngularDamping(MODEL.trailerAngularDamping)
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
        .setFriction(TRAILER.headboardFriction)
        .setRestitution(TRAILER.headboardRestitution),
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
    const truckYawRate = Math.atan2(Math.sin(p.angle - this.truck.rotation()), Math.cos(p.angle - this.truck.rotation())) / dt;
    this.truck.setNextKinematicTranslation({ x: p.x, y: p.y });
    this.truck.setNextKinematicRotation(p.angle);

    this.applyTrailerGrip(dt);
    this.applyHitchDamping(dt, truckYawRate);
  }

  applyHitchDamping(dt, truckYawRate) {
    const rel = this.trailer.angvel() - truckYawRate;
    this.trailer.applyTorqueImpulse(-HITCH_DAMP * rel * dt, true);
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
    const slip = Math.atan2(vLat, Math.max(Math.abs(vFwd), MODEL.trailerSlipSpeedFloor));

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
